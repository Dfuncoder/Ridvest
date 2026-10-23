"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSACTION PIN — setting it, changing it, resetting a forgotten one.
 *
 * The PIN itself never lives here. It is passed straight to SQL, hashed with
 * bcrypt by set_transaction_pin(), and compared by verify_transaction_pin().
 * Nothing in this file, in a log, or in the database can be turned back into
 * the four digits — which is the whole point of hashing it rather than
 * encrypting it the way the NIN is.
 *
 * Verification for actual payments does NOT happen here either. It happens
 * inside request_withdrawal(), join_pool_from_balance() and
 * transfer_to_user(), in the same transaction that moves the money, so a
 * request that bypasses these actions still cannot bypass the PIN.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { SetPinSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

/** Pages that show whether a PIN exists, or are gated on having one. */
function revalidateAll() {
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/payouts");
  revalidatePath("/dashboard/pools");
  revalidatePath("/dashboard/transfer");
}

/**
 * Sets a PIN, or changes an existing one.
 *
 * Changing requires the current PIN — enforced in SQL, not here. Somebody who
 * picks up an unlocked phone should not be able to quietly swap the PIN for
 * one of their own and then empty the balance.
 */
export async function setTransactionPin(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireUser();

  const parsed = SetPinSchema.safeParse({
    pin: formData.get("pin"),
    confirmPin: formData.get("confirmPin"),
    currentPin: formData.get("currentPin") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_transaction_pin", {
    p_new_pin: parsed.data.pin,
    p_current_pin: parsed.data.currentPin || null,
    p_force: false,
  });

  if (error) {
    console.error("[pin] set_transaction_pin failed", error.message);
    return { message: ERRORS.PIN_SET_FAILED };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    const reason = result?.reason ?? "";
    // Put the message on the field it belongs to, so the user knows which box
    // to fix rather than re-reading the whole form.
    if (reason === "current_pin_wrong") {
      return { errors: { currentPin: ERRORS.PIN_CURRENT_WRONG } };
    }
    if (reason === "pin_too_simple" || reason === "pin_invalid") {
      return { errors: { pin: DB_REASON_TO_ERROR[reason] ?? ERRORS.PIN_INVALID } };
    }
    return { message: DB_REASON_TO_ERROR[reason] ?? ERRORS.PIN_SET_FAILED };
  }

  revalidateAll();
  return { success: true, message: "Your transaction PIN is set." };
}

/**
 * Resets a forgotten PIN, after re-entering the account password.
 *
 * The password is the only thing left to prove it is really them — they
 * cannot produce the current PIN by definition. Verified by asking Supabase to
 * sign in with it, which never exposes the stored password hash to us.
 */
export async function resetTransactionPin(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  if (!password) return { errors: { password: ERRORS.PIN_PASSWORD_WRONG } };

  const parsed = SetPinSchema.safeParse({
    pin: formData.get("pin"),
    confirmPin: formData.get("confirmPin"),
    currentPin: "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();

  // Re-authenticate. A wrong password is the common case here, not an error
  // worth logging — somebody mistyping is exactly who this is protecting.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) {
    return { errors: { password: ERRORS.PIN_PASSWORD_WRONG } };
  }

  const { data, error } = await supabase.rpc("set_transaction_pin", {
    p_new_pin: parsed.data.pin,
    p_current_pin: null,
    // The password check above is what stands in for the old PIN.
    p_force: true,
  });

  if (error) {
    console.error("[pin] reset failed", error.message);
    return { message: ERRORS.PIN_SET_FAILED };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    const reason = result?.reason ?? "";
    if (reason === "pin_too_simple" || reason === "pin_invalid") {
      return { errors: { pin: DB_REASON_TO_ERROR[reason] ?? ERRORS.PIN_INVALID } };
    }
    return { message: DB_REASON_TO_ERROR[reason] ?? ERRORS.PIN_SET_FAILED };
  }

  revalidateAll();
  return { success: true, message: "Your transaction PIN has been reset." };
}
