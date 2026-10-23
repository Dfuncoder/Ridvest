"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SENDING BALANCE TO ANOTHER ACCOUNT — server actions.
 *
 * Both actions are thin: every rule that matters lives in SQL, inside
 * transfer_to_user(), which runs the whole thing under a lock on both profile
 * rows. Nothing here can authorise a transfer the database would refuse, and
 * nothing here needs to be trusted for the money to be right.
 *
 * Both are called with the USER's client, so auth.uid() inside those functions
 * is the real logged-in person. The admin client is deliberately NOT used:
 * a transfer must never run with RLS bypassed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS, DB_REASON_TO_ERROR, DYNAMIC_ERRORS } from "@/lib/errors";
import { pinFieldError } from "@/lib/pin";
import { TransferSchema, UserCodeSchema, PinSchema } from "@/lib/validation";
import { fmtNaira } from "@/lib/format";
import type { FormState } from "./auth";

export type LookupResult =
  | { ok: true; code: string; name: string }
  | { ok: false; message: string };

/**
 * Who owns an account ID.
 *
 * Called while the sender is typing the ID, so they see the name before any
 * money moves. Rate limited in SQL — an unlimited version of this would be a
 * directory of every customer's name.
 */
export async function lookupUserCode(rawCode: string): Promise<LookupResult> {
  await requireUser();

  const parsed = UserCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return { ok: false, message: ERRORS.TRANSFER_CODE_INVALID };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_user_code", {
    p_code: parsed.data,
  });

  if (error) {
    console.error("[transfer] resolve_user_code failed", error);
    return { ok: false, message: ERRORS.GENERIC };
  }

  const result = data as { ok?: boolean; reason?: string; code?: string; name?: string } | null;
  if (!result?.ok) {
    return {
      ok: false,
      message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.TRANSFER_RECIPIENT_NOT_FOUND,
    };
  }

  return { ok: true, code: result.code!, name: result.name ?? "" };
}

/**
 * Send it.
 *
 * The form posts the recipient's name back as `confirmedName`, and this
 * refuses unless it still matches what the account ID resolves to now. That
 * closes the window where somebody pastes a different ID after the name was
 * shown — the person confirms a name, so a name is what gets checked.
 */
export async function sendTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();

  const parsed = TransferSchema.safeParse({
    code: formData.get("code"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const out: Record<string, string> = {};
    for (const issue of issues) {
      const key = String(issue.path[0] ?? "form");
      if (!out[key]) out[key] = issue.message;
    }
    return { errors: out };
  }

  const pin = PinSchema.safeParse(formData.get("pin"));
  if (!pin.success) return { errors: { pin: ERRORS.PIN_REQUIRED } };

  const confirmedName = String(formData.get("confirmedName") ?? "").trim();
  if (!confirmedName) {
    return { message: ERRORS.TRANSFER_NOT_CONFIRMED };
  }

  const supabase = await createSupabaseServerClient();

  // Re-resolve and compare against what the sender was shown. A mismatch means
  // the ID in the form is no longer the account whose name they agreed to.
  const check = await lookupUserCode(parsed.data.code);
  if (!check.ok) return { errors: { code: check.message } };
  if (check.name.trim() !== confirmedName) {
    return { message: ERRORS.TRANSFER_NOT_CONFIRMED };
  }

  const { data, error } = await supabase.rpc("transfer_to_user", {
    p_code: parsed.data.code,
    p_amount: parsed.data.amount,
    p_pin: pin.data,
    p_note: parsed.data.note || null,
  });

  if (error) {
    console.error("[transfer] transfer_to_user failed", error);
    return { message: ERRORS.TRANSFER_FAILED };
  }

  const result = data as {
    ok?: boolean;
    reason?: string;
    minimum?: number;
    maximum?: number;
    remaining_today?: number;
    recipient_name?: string;
    amount?: number;
    reference?: string;
    fee?: number;
    attempts_left?: number;
  } | null;

  if (!result?.ok) {
    const pinError = pinFieldError(result);
    if (pinError) return { errors: { pin: pinError } };

    switch (result?.reason) {
      case "below_minimum":
        return {
          errors: { amount: DYNAMIC_ERRORS.TRANSFER_MINIMUM(fmtNaira(result.minimum ?? 0)) },
        };
      case "above_maximum":
        return {
          errors: { amount: DYNAMIC_ERRORS.TRANSFER_MAXIMUM(fmtNaira(result.maximum ?? 0)) },
        };
      case "daily_limit": {
        const left = Number(result.remaining_today ?? 0);
        return {
          errors: {
            amount:
              left > 0
                ? DYNAMIC_ERRORS.TRANSFER_REMAINING_TODAY(fmtNaira(left))
                : ERRORS.TRANSFER_DAILY_LIMIT_REACHED,
          },
        };
      }
      case "insufficient_balance":
        return { errors: { amount: ERRORS.INSUFFICIENT_BALANCE } };
      case "invalid_amount":
        return { errors: { amount: ERRORS.TRANSFER_INVALID_AMOUNT } };
      default:
        return {
          message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.TRANSFER_FAILED,
        };
    }
  }

  // Both sides change, and the sender's balance shows on several screens.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transfer");
  revalidatePath("/dashboard/history");
  revalidatePath("/dashboard/pools");
  revalidatePath("/dashboard/payouts");

  return {
    success: true,
    message: `Sent ${fmtNaira(Number(result.amount ?? 0))} to ${result.recipient_name}.`,
  };
}
