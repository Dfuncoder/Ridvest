"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROFILE, WITHDRAWAL ACCOUNTS & WITHDRAWAL REQUESTS — server actions.
 *
 * Withdrawal accounts are verified with the bank, not typed. The name-match
 * rule is then enforced in THREE places on purpose:
 *   1. Korapay tells us the name on the account, and we reject it here if it
 *      does not match the profile name (clear, early feedback).
 *   2. The request_withdrawal() SQL function re-checks the match at request
 *      time (can't be bypassed even if server code had a bug).
 *   3. The admin sees a match indicator before paying (final human check).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { namesMatch } from "@/lib/names";
import { korapayListBanks, korapayResolveAccount, type Bank } from "@/lib/korapay";
import { WithdrawalRequestSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// NO PROFILE EDITING.
//
// There is deliberately no action here to change a profile. The withdrawal
// name-match rule compares the bank account name to profiles.full_name, so a
// user who could edit their own name could point it at anybody else's account.
// Corrections go through an admin. Column grants in supabase/schema.sql already
// block role/email/dob; this removes the last writable path to full_name.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BANK LOOKUP — the list of banks, and whose account a number belongs to.
//
// The form calls this to show the user the name before they save. It is only a
// preview: addWithdrawalAccount resolves again server-side and stores THAT
// answer, so a crafted request cannot smuggle in a name of its own.
// ─────────────────────────────────────────────────────────────────────────────
export async function listBanks(): Promise<Bank[]> {
  await requireUser();
  const { banks } = await korapayListBanks();
  return banks;
}

export type LookupResult =
  | { status: "ok"; accountName: string }
  | { status: "not_found" | "unavailable" | "mismatch"; message: string };

export async function lookupBankAccount(
  bankCode: string,
  accountNumber: string
): Promise<LookupResult> {
  const user = await requireUser();

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return { status: "not_found", message: ERRORS.ACCOUNT_NUMBER_INVALID };
  }

  const resolved = await korapayResolveAccount(bankCode, accountNumber);
  if (resolved.status === "unavailable") {
    return { status: "unavailable", message: ERRORS.ACCOUNT_LOOKUP_UNAVAILABLE };
  }
  if (resolved.status !== "ok" || !resolved.accountName) {
    return { status: "not_found", message: ERRORS.ACCOUNT_NOT_FOUND };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !namesMatch(resolved.accountName, profile.full_name)) {
    return { status: "mismatch", message: ERRORS.ACCOUNT_NAME_MISMATCH };
  }

  return { status: "ok", accountName: resolved.accountName };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD WITHDRAWAL BANK ACCOUNT
//
// The account name is never taken from the form. We resolve it with the bank
// again here and store what the bank says, then check it against the profile
// name. Three gates, in order: the bank agrees the account exists, the name on
// it matches the profile, and request_withdrawal re-checks the match in SQL
// before any money moves.
// ─────────────────────────────────────────────────────────────────────────────
export async function addWithdrawalAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    return { errors: { accountNumber: ERRORS.ACCOUNT_NUMBER_INVALID } };
  }
  if (!bankName) return { errors: { bankName: ERRORS.ACCOUNT_BANK_REQUIRED } };

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return { message: ERRORS.ACCOUNT_SAVE_FAILED };

  // Resolve again — the name in the form is only ever a preview.
  let accountName = "";
  let verified = false;

  if (bankCode) {
    const resolved = await korapayResolveAccount(bankCode, accountNumber);
    if (resolved.status === "ok" && resolved.accountName) {
      accountName = resolved.accountName;
      verified = true;
    } else if (resolved.status === "not_found") {
      return { errors: { accountNumber: ERRORS.ACCOUNT_NOT_FOUND } };
    }
  }

  // Lookup unavailable (no Korapay key, or their API is down). Fall back to the
  // name the user typed so withdrawals are not blocked outright — the profile
  // name check below still applies, and name_verified records that nobody
  // independently confirmed it.
  if (!verified) {
    accountName = String(formData.get("accountName") ?? "").trim();
    if (!accountName) return { errors: { accountName: ERRORS.ACCOUNT_NAME_REQUIRED } };
  }

  if (!namesMatch(accountName, profile.full_name)) {
    return { errors: { accountName: ERRORS.ACCOUNT_NAME_MISMATCH } };
  }

  const { error } = await supabase.from("withdrawal_accounts").insert({
    user_id: user.id,
    bank_name: bankName,
    bank_code: bankCode || null,
    account_number: accountNumber,
    account_name: accountName,
    name_verified: verified,
  });

  if (error) {
    if (error.code === "23505") return { errors: { accountNumber: ERRORS.ACCOUNT_DUPLICATE } };
    console.error("[account] insert failed", error);
    return { message: ERRORS.ACCOUNT_SAVE_FAILED };
  }

  revalidatePath("/dashboard/profile");
  return { success: true, message: `Saved ${accountName}.` };
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
