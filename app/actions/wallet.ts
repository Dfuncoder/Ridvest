"use server";

/**
 * FUNDING THE BALANCE — server actions.
 *
 * Two routes in, chosen by the admin's payment_method setting:
 *   korapay — hosted checkout; credited only by the signature-verified webhook.
 *   manual  — the user transfers to the company account and tells us. Nothing
 *             is credited until an admin confirms the money actually arrived.
 *
 * The user id always comes from the verified session, never from a form field,
 * and every amount is re-validated in SQL before it moves.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  korapayInitialize,
  generateDepositReference,
  generateConfirmToken,
} from "@/lib/korapay";
import { getPaymentSettings } from "@/lib/settings";
import { sendEmail, noReplyFrom } from "@/lib/email";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { FundWalletSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// KORAPAY — create a pending deposit, then hand off to hosted checkout.
// ─────────────────────────────────────────────────────────────────────────────
export async function startKorapayDeposit(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const parsed = FundWalletSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const settings = await getPaymentSettings();
  if (settings.method !== "korapay") return { message: ERRORS.PAYMENT_INIT_FAILED };

  const { amount } = parsed.data;
  const admin = createSupabaseAdminClient();
  const reference = generateDepositReference();

  const { error: insertError } = await admin.from("deposits").insert({
    user_id: user.id,
    amount,
    method: "korapay",
    status: "pending",
    reference,
  });
  if (insertError) {
    console.error("[wallet] deposit insert failed", insertError);
    return { message: ERRORS.PAYMENT_INIT_FAILED };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const init = await korapayInitialize({
    email: user.email,
    name: profile?.full_name || user.email,
    amountKobo: amount * 100,
    reference,
    redirectUrl: `${siteUrl()}/dashboard/wallet/callback`,
    notificationUrl: `${siteUrl()}/api/webhooks/korapay`,
    narration: "Rydvest wallet funding",
  });

  if (!init.ok || !init.checkoutUrl) {
    await admin.from("deposits").delete().eq("reference", reference);
    return { message: ERRORS.PAYMENT_INIT_FAILED };
  }

  redirect(init.checkoutUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL TRANSFER — the user tells us they have sent money to the company
// account. No amount is asked for: whatever they typed would be a claim, and
// the only figure we trust is what an admin reads off the bank account.
// ─────────────────────────────────────────────────────────────────────────────
export async function declareManualTransfer(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const settings = await getPaymentSettings();
  if (settings.method !== "manual") return { message: ERRORS.DEPOSIT_DECLARE_FAILED };

  const reference = generateDepositReference();
  const token = generateConfirmToken();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("declare_manual_deposit", {
    p_reference: reference,
    p_token: token,
  });

  if (error) {
    console.error("[wallet] declare_manual_deposit failed", error);
    return { message: ERRORS.DEPOSIT_DECLARE_FAILED };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    return {
      message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.DEPOSIT_DECLARE_FAILED,
    };
  }

  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: accounts }] = await Promise.all([
    admin.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    admin
      .from("withdrawal_accounts")
      .select("bank_name, account_number, account_name")
      .eq("user_id", user.id),
  ]);

  // The user should not wait on Resend for their confirmation screen.
  after(async () => {
    await notifyAdminsOfTransfer({
      emails: settings.notifyEmails,
      token,
      reference,
      userName: profile?.full_name ?? "",
      userEmail: user.email,
      userPhone: profile?.phone ?? "",
      accounts: (accounts ?? []).map(
        (a) => `${a.bank_name} · ${a.account_number} · ${a.account_name}`
      ),
    });
  });

  revalidatePath("/dashboard/wallet");
  return {
    success: true,
    message: "Transfer submitted. We are confirming it now.",
  };
}

async function notifyAdminsOfTransfer(params: {
  emails: string[];
  token: string;
  reference: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  accounts: string[];
}) {
  const link = `${siteUrl()}/admin/deposits/confirm/${params.token}`;
  const who = params.userName || params.userEmail;
  const body = [
    `${who} says they have sent a bank transfer to fund their Rydvest balance.`,
    ``,
    `Name:      ${params.userName || "—"}`,
    `Email:     ${params.userEmail}`,
    `Phone:     ${params.userPhone || "—"}`,
    `Reference: ${params.reference}`,
    ``,
    params.accounts.length > 0
      ? ["Bank accounts on file for this user:", ...params.accounts.map((a) => `  ${a}`)].join("\n")
      : "This user has no bank account on file yet — match on the sender name.",
    ``,
    `Find the credit in the Rydvest account, check the sender name matches, then`,
    `confirm the exact amount that landed here:`,
    link,
    ``,
    `Nothing is credited until someone opens that link and enters the amount.`,
  ].join("\n");

  for (const to of params.emails) {
    const res = await sendEmail({
      from: noReplyFrom(),
      to,
      subject: `Transfer to confirm — ${who}`,
      text: body,
    });
    if (!res.ok) console.error("[wallet] notify failed for", to, res.body);
  }
}
