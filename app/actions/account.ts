"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROFILE, WITHDRAWAL ACCOUNTS & WITHDRAWAL REQUESTS — server actions.
 *
 * The withdrawal name-match rule is enforced in THREE places on purpose:
 *   1. Saving a bank account whose holder name doesn't match the profile
 *      name is rejected here (clear, early feedback).
 *   2. The request_withdrawal() SQL function re-checks the match at request
 *      time (can't be bypassed even if server code had a bug).
 *   3. The admin sees a match indicator before paying (final human check).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import {
  ProfileUpdateSchema,
  WithdrawalAccountSchema,
  WithdrawalRequestSchema,
  fieldErrors,
} from "@/lib/validation";
import type { FormState } from "./auth";

/** Case- and whitespace-insensitive name comparison. */
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE — uses the USER-scoped client: RLS restricts to their own
// row, and column grants stop them touching role/email/dob.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = ProfileUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    state: formData.get("state"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      address: parsed.data.address,
      state_of_residence: parsed.data.state,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] update failed", error);
    return { message: ERRORS.PROFILE_UPDATE_FAILED };
  }

  revalidatePath("/dashboard/profile");
  return { success: true, message: "Profile updated." };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD WITHDRAWAL BANK ACCOUNT — the account name MUST match the profile name.
// ─────────────────────────────────────────────────────────────────────────────
export async function addWithdrawalAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = WithdrawalAccountSchema.safeParse({
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();

  // ★ Name-match rule (check #1 of 3 — see file header).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  if (!profile || !namesMatch(parsed.data.accountName, profile.full_name)) {
    return { errors: { accountName: ERRORS.ACCOUNT_NAME_MISMATCH } };
  }

  // Insert with the user client — RLS forces user_id = auth.uid().
  const { error } = await supabase.from("withdrawal_accounts").insert({
    user_id: user.id,
    bank_name: parsed.data.bankName,
    account_number: parsed.data.accountNumber,
    account_name: parsed.data.accountName,
  });

  if (error) {
    if (error.code === "23505") return { errors: { accountNumber: ERRORS.ACCOUNT_DUPLICATE } };
    console.error("[account] insert failed", error);
    return { message: ERRORS.ACCOUNT_SAVE_FAILED };
  }

  revalidatePath("/dashboard/profile");
  return { success: true, message: "Bank account added." };
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE A WITHDRAWAL ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteWithdrawalAccount(formData: FormData): Promise<void> {
  await requireUser();
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  // RLS guarantees a user can only delete their own account rows.
  const supabase = await createSupabaseServerClient();
  await supabase.from("withdrawal_accounts").delete().eq("id", accountId);
  revalidatePath("/dashboard/profile");
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST A WITHDRAWAL — delegates to the request_withdrawal() SQL function,
// which atomically enforces: account ownership, the name-match rule, the
// available balance, and one-pending-request-at-a-time.
// ─────────────────────────────────────────────────────────────────────────────
export async function requestWithdrawal(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();

  const parsed = WithdrawalRequestSchema.safeParse({
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Called with the USER client so auth.uid() inside the function is the
  // real logged-in user.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_account_id: parsed.data.accountId,
    p_amount: parsed.data.amount,
  });

  if (error) {
    console.error("[withdrawal] rpc failed", error);
    return { message: ERRORS.WITHDRAW_FAILED };
  }

  const result = data as { ok: boolean; reason?: string };
  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.WITHDRAW_FAILED };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/payouts");
  return { success: true, message: "Withdrawal request submitted. You'll be paid once it's approved." };
}
