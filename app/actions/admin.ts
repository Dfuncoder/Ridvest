"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN SERVER ACTIONS — everything the admin dashboard can do.
 *
 * Every action starts with requireAdmin(): the caller must have a valid
 * session AND profiles.role = 'admin' (users cannot self-promote — the role
 * column is not updatable by authenticated users, see supabase/schema.sql).
 * Every state-changing action is recorded in audit_log.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, supportFrom, supportEmail, noReplyFrom } from "@/lib/email";
import { parseEmailList, MONEY_KEYS, SWITCH_KEYS, NIN_PROVIDER_KEY } from "@/lib/settings";
import { isNinProvider } from "@/lib/nin";
import { monnifyListBanks, monnifyValidateAccount, type Bank } from "@/lib/monnify";
import { fmtNaira } from "@/lib/format";
import { totalPackage } from "@/lib/economics";
import { receiptSubject, receiptText, receiptHtml, type Receipt } from "@/lib/receipt";
import {
  kycApprovedSubject, kycApprovedText, kycApprovedHtml,
  kycRejectedSubject, kycRejectedText, kycRejectedHtml,
} from "@/lib/notices";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { decryptSecret } from "@/lib/crypto";
import { runNinLookup } from "./kyc";
import { lookupIsStale } from "@/lib/kyc";
import {
  PoolProductSchema,
  PaymentSettingsSchema,
  MoneySettingsSchema,
  fieldErrors,
} from "@/lib/validation";
import type { FormState } from "./auth";

/** Writes one audit trail row for an admin action. */
async function audit(actorId: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({ actor_id: actorId, action, target, detail });
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL PRODUCTS — the investment options (e.g. "Keke Napep", price, weeks, ROI)
// ─────────────────────────────────────────────────────────────────────────────
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const parsed = PoolProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    targetAmount: formData.get("targetAmount"),
    minContribution: formData.get("minContribution"),
    durationWeeks: formData.get("durationWeeks"),
    roiPercent: formData.get("roiPercent"),
    imagePath: formData.get("imagePath") ?? "",
    availability: formData.get("availability") ?? "both",
    privateMinContribution: formData.get("privateMinContribution") ?? "",
    assetValue: formData.get("assetValue") ?? 0,
    vat: formData.get("vat") ?? 0,
    serviceCharge: formData.get("serviceCharge") ?? 0,
    maintenanceFee: formData.get("maintenanceFee") ?? 0,
    companyCharge: formData.get("companyCharge") ?? 0,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.minContribution > parsed.data.targetAmount) {
    return { errors: { minContribution: ERRORS.ADMIN_PRODUCT_INVALID } };
  }

  // The breakdown is all-or-nothing, and when given it has to equal the pool
  // price. The database enforces this too; failing here just means the admin
  // is told which number is wrong instead of seeing a constraint error.
  const parts = {
    assetValue: parsed.data.assetValue,
    vat: parsed.data.vat,
    serviceCharge: parsed.data.serviceCharge,
    maintenanceFee: parsed.data.maintenanceFee,
    companyCharge: parsed.data.companyCharge,
  };
  const itemised = Object.values(parts).some((v) => v > 0);
  if (itemised && totalPackage(parts) !== parsed.data.targetAmount) {
    return { errors: { assetValue: ERRORS.ADMIN_BREAKDOWN_MISMATCH } };
  }

  if (
    parsed.data.privateMinContribution !== null &&
    parsed.data.privateMinContribution > parsed.data.targetAmount
  ) {
    return { errors: { privateMinContribution: ERRORS.ADMIN_PRODUCT_INVALID } };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pool_products")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      target_amount: parsed.data.targetAmount,
      min_contribution: parsed.data.minContribution,
      duration_weeks: parsed.data.durationWeeks,
      roi_percent: parsed.data.roiPercent,
      // Empty means the card works the image out from the name instead.
      image_path: parsed.data.imagePath || null,
      availability: parsed.data.availability,
      private_min_contribution: parsed.data.privateMinContribution,
      asset_value: itemised ? parts.assetValue : null,
      vat: itemised ? parts.vat : null,
      service_charge: itemised ? parts.serviceCharge : null,
      maintenance_fee: itemised ? parts.maintenanceFee : null,
      company_charge: itemised ? parts.companyCharge : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin] createProduct failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "product.create", data.id, { name: parsed.data.name });
  revalidatePath("/admin/products");
  return { success: true, message: "Pool option created." };
}

/** Enable/disable a product. Disabled products can't take new investments. */
export async function toggleProductActive(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = String(formData.get("productId") ?? "");
  const active = String(formData.get("active")) === "true";
  if (!id) return;

  const admin = createSupabaseAdminClient();
  await admin.from("pool_products").update({ active }).eq("id", id);
  await audit(user.id, active ? "product.activate" : "product.deactivate", id);
  revalidatePath("/admin/products");
}

// ─────────────────────────────────────────────────────────────────────────────
// POOLS
// ─────────────────────────────────────────────────────────────────────────────
/** Opens an official (admin-created, public) pool from a product. */
export async function createOfficialPool(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  const admin = createSupabaseAdminClient();
  const { data: product } = await admin
    .from("pool_products")
    .select("id, name, active")
    .eq("id", productId)
    .single();
  if (!product || !product.active) return;

  // The admin can name the pool whatever the vehicle is actually called; left
  // blank it simply takes the product's name. No auto-numbering — a pool is
  // identified by what it is, not by how many came before it.
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || product.name;

  const { data: pool } = await admin
    .from("pools")
    .insert({
      product_id: productId,
      name,
      is_private: false,
    })
    .select("id")
    .single();

  if (pool) await audit(user.id, "pool.create_official", pool.id, { product: product.name });
  revalidatePath("/admin/pools");
}

/**
 * Cancels an OPEN pool. Only allowed while it holds no confirmed money —
 * pools with paid investments must run or be refunded investment-by-investment.
 */
export async function cancelPool(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const poolId = String(formData.get("poolId") ?? "");
  if (!poolId) return;

  const admin = createSupabaseAdminClient();
  const { data: pool } = await admin
    .from("pools")
    .select("id, status, amount_raised")
    .eq("id", poolId)
    .single();

  if (!pool || pool.status !== "open" || Number(pool.amount_raised) > 0) return;

  await admin.from("pools").update({ status: "cancelled" }).eq("id", poolId);
  await audit(user.id, "pool.cancel", poolId);
  revalidatePath("/admin/pools");
}

// ─────────────────────────────────────────────────────────────────────────────
// Payouts settle automatically on their due date; the actions for running that
// by hand and for reverting a bad payout are further down this file. There is
// deliberately no 'mark this one paid' any more — a single payout credited
// outside the schedule is exactly the kind of entry nobody can later explain.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWALS — pending → approved → paid, or pending → rejected
// ─────────────────────────────────────────────────────────────────────────────
async function transitionWithdrawal(
  actorId: string,
  withdrawalId: string,
  from: string[],
  to: "approved" | "paid" | "rejected",
  note?: string
) {
  const now = new Date().toISOString();

  // Approving and paying are often different people, so each is stamped with
  // its own actor rather than one "processed by" that the last action wins.
  const patch: Record<string, unknown> =
    to === "approved"
      ? { status: to, admin_note: note ?? null, approved_by: actorId, approved_at: now, processed_at: null }
      : { status: to, admin_note: note ?? null, processed_by: actorId, processed_at: now };

  const admin = createSupabaseAdminClient();
  const { data: updated, error } = await admin
    .from("withdrawals")
    .update(patch)
    .eq("id", withdrawalId)
    .in("status", from)
    .select("id, user_id, amount")
    .single();

  if (error) console.error("[admin] withdrawal transition failed", error.message);
  if (!updated) return;

  // Keep the ledger in sync with the withdrawal's fate.
  if (to === "paid" || to === "rejected") {
    await admin
      .from("transactions")
      .update({ status: to === "paid" ? "success" : "failed" })
      .eq("reference", withdrawalId)
      .eq("type", "withdrawal");
  }

  await audit(actorId, `withdrawal.${to}`, withdrawalId, { amount: updated.amount, note });
  revalidatePath("/admin/withdrawals");
}

export async function approveWithdrawal(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  await transitionWithdrawal(user.id, String(formData.get("withdrawalId") ?? ""), ["pending"], "approved");
}

/** Mark paid AFTER you've actually sent the bank transfer. */
export async function markWithdrawalPaid(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  await transitionWithdrawal(user.id, String(formData.get("withdrawalId") ?? ""), ["pending", "approved"], "paid");
}

/** Rejecting returns the money to the user's available balance automatically. */
export async function rejectWithdrawal(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const note = String(formData.get("note") ?? "").slice(0, 300) || "Rejected by admin";
  await transitionWithdrawal(user.id, String(formData.get("withdrawalId") ?? ""), ["pending", "approved"], "rejected", note);
}

// ─────────────────────────────────────────────────────────────────────────────
// INVESTMENT REFUNDS — for payments that arrived after a pool filled.
// The actual refund is issued from the Korapay dashboard; this records it.
// ─────────────────────────────────────────────────────────────────────────────
export async function markInvestmentRefunded(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const investmentId = String(formData.get("investmentId") ?? "");
  if (!investmentId) return;

  const admin = createSupabaseAdminClient();
  const { data: updated } = await admin
    .from("investments")
    .update({ status: "refunded" })
    .eq("id", investmentId)
    .eq("status", "refund_pending")
    .select("id, payment_reference")
    .single();

  if (!updated) return;

  await admin
    .from("transactions")
    .update({ status: "success" })
    .eq("reference", updated.payment_reference)
    .eq("type", "refund");

  await audit(user.id, "investment.mark_refunded", investmentId);
  revalidatePath("/admin/investments");
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS — "reset user dashboard": sends the user a password-reset email so
// they can regain access; their data is untouched.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendUserPasswordReset(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });

  await audit(user.id, "user.password_reset_sent", email);
  revalidatePath("/admin/users");
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT MESSAGES — reply from the dashboard
// The email goes out FROM the support inbox (support@rydvest.com) TO the
// address the visitor typed into the form; reply-to is also the support
// inbox, so if the customer answers, it lands in Zoho alongside everything
// else. The reply text is stored for the audit trail.
// ─────────────────────────────────────────────────────────────────────────────
export async function replyToMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, profile } = await requireAdmin();

  const messageId = String(formData.get("messageId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!messageId) return { message: ERRORS.ADMIN_ACTION_FAILED };
  if (body.length < 2 || body.length > 5000) {
    return { errors: { body: "Please write a reply (up to 5000 characters)." } };
  }

  const admin = createSupabaseAdminClient();
  const { data: msg } = await admin
    .from("contact_messages")
    .select("id, name, email, message")
    .eq("id", messageId)
    .single();
  if (!msg) return { message: ERRORS.ADMIN_ACTION_FAILED };

  // Send the actual email. If Resend rejects it, surface that to the admin
  // instead of pretending it went out.
  const result = await sendEmail({
    from: supportFrom(),          // "Rydvest Support <support@rydvest.com>"
    to: msg.email,                // the address the visitor gave in the form
    replyTo: supportEmail(),      // their answer comes back to the support inbox
    subject: `Re: your message to Rydvest`,
    text: [
      `Hi ${msg.name},`,
      ``,
      body,
      ``,
      `— ${profile.full_name}, Rydvest Support`,
      ``,
      `-----------------------------------------`,
      `You wrote:`,
      msg.message,
    ].join("\n"),
  });

  if (!result.ok) {
    return { message: "Email could not be sent — check the server logs (Resend rejected it)." };
  }

  // Record the reply and close the message.
  await admin.from("contact_replies").insert({
    message_id: msg.id,
    admin_id: user.id,
    body,
  });
  await admin.from("contact_messages").update({ handled: true }).eq("id", msg.id);
  await audit(user.id, "contact.reply", msg.id, { to: msg.email });

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${messageId}`);
  return { success: true, message: `Reply sent to ${msg.email}.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT MESSAGES — mark a "Talk to us" message as handled
// ─────────────────────────────────────────────────────────────────────────────
export async function markMessageHandled(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return;

  const admin = createSupabaseAdminClient();
  await admin.from("contact_messages").update({ handled: true }).eq("id", messageId);
  await audit(user.id, "contact.mark_handled", messageId);
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${messageId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — the public headline interest rate
// ─────────────────────────────────────────────────────────────────────────────
export async function updateInterestRate(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const value = Number(formData.get("percent"));
  if (Number.isNaN(value) || value < 0 || value > 1000) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from("app_settings")
    .upsert({ key: "interest_rate_percent", value: String(value), updated_at: new Date().toISOString() });

  await audit(user.id, "settings.interest_rate", String(value));
  revalidatePath("/admin");
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSITS — confirm or reject a manual bank transfer.
//
// Crediting happens in SQL under a row lock, so a double-click or two admins
// opening the same email link can only ever credit once.
// ─────────────────────────────────────────────────────────────────────────────
export async function confirmDeposit(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const depositId = String(formData.get("depositId") ?? "");
  if (!depositId) return { message: ERRORS.ADMIN_ACTION_FAILED };

  // The user never states an amount, so this is the only figure in play: what
  // the admin actually sees in the bank account.
  const actualAmount = Number(formData.get("actualAmount"));
  if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
    return { errors: { actualAmount: ERRORS.DEPOSIT_INVALID_AMOUNT } };
  }

  const field = (name: string, max: number) =>
    String(formData.get(name) ?? "").trim().slice(0, max);

  const destinationAccount = field("destinationAccount", 120);
  const initiator = field("initiator", 120);
  const narration = field("narration", 200);

  if (!narration) return { errors: { narration: ERRORS.DEPOSIT_NARRATION_REQUIRED } };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("confirm_manual_deposit", {
    p_deposit_id: depositId,
    p_admin_id: user.id,
    p_actual_amount: actualAmount,
    p_destination_account: destinationAccount || null,
    p_initiator: initiator || null,
    p_narration: narration,
  });

  if (error) {
    console.error("[admin] confirm_manual_deposit failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as {
    ok?: boolean;
    reason?: string;
    amount?: number;
    user_id?: string;
    reference?: string;
    initiated_at?: string;
  } | null;
  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "deposit.confirm", depositId, { amount: result.amount, narration });

  // Receipt goes out once, on the confirmation that actually credited.
  if (result.reason !== "already_processed" && result.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", result.user_id)
      .single();

    if (profile?.email) {
      const receipt: Receipt = {
        recipientName: profile.full_name ?? "",
        amount: Number(result.amount ?? 0),
        reference: result.reference ?? "",
        destinationAccount,
        initiator: initiator || (profile.full_name ?? ""),
        narration,
        initiatedAt: result.initiated_at ?? null,
        completedAt: new Date(),
      };

      await sendEmail({
        from: noReplyFrom(),
        to: profile.email,
        replyTo: supportEmail(),
        subject: receiptSubject(receipt),
        text: receiptText(receipt),
        html: receiptHtml(receipt),
      });
    }
  }

  revalidatePath("/admin/deposits");
  revalidatePath("/admin");
  return { success: true, message: `Credited ${fmtNaira(result.amount ?? 0)}.` };
}

export async function rejectDeposit(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const depositId = String(formData.get("depositId") ?? "");
  if (!depositId) return { message: ERRORS.ADMIN_ACTION_FAILED };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reject_manual_deposit", {
    p_deposit_id: depositId,
    p_admin_id: user.id,
    p_note: note || null,
  });

  if (error) {
    console.error("[admin] reject_manual_deposit failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as { ok?: boolean; reason?: string; user_id?: string } | null;
  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "deposit.reject", depositId, { note });

  if (result.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", result.user_id)
      .single();

    if (profile?.email) {
      await sendEmail({
        from: supportFrom(),
        to: profile.email,
        replyTo: supportEmail(),
        subject: "We couldn't confirm your transfer",
        text:
          `Hi ${profile.full_name || "there"},\n\n` +
          `We couldn't match your recent bank transfer to money arriving in our account, so your balance hasn't been credited.\n\n` +
          (note ? `Note from our team: ${note}\n\n` : "") +
          `If you believe this is a mistake, reply to this email with your transfer receipt and we'll sort it out.\n\n` +
          `— The Rydvest team`,
      });
    }
  }

  revalidatePath("/admin/deposits");
  return { success: true, message: "Transfer rejected and the user notified." };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — how users fund their balance, and who gets told about transfers
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePaymentSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const parsed = PaymentSettingsSchema.safeParse({
    method: formData.get("method"),
    bankName: formData.get("bankName"),
    accountName: formData.get("accountName"),
    accountNumber: formData.get("accountNumber"),
    notifyEmails: formData.get("notifyEmails") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const emails = parseEmailList(parsed.data.notifyEmails);
  if (emails.length === 0) {
    return { errors: { notifyEmails: "Add at least one valid email address." } };
  }

  const now = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("app_settings").upsert([
    { key: "payment_method", value: parsed.data.method, updated_at: now },
    { key: "bank_name", value: parsed.data.bankName, updated_at: now },
    { key: "bank_account_name", value: parsed.data.accountName, updated_at: now },
    { key: "bank_account_number", value: parsed.data.accountNumber, updated_at: now },
    { key: "deposit_notify_emails", value: emails.join(", "), updated_at: now },
  ]);

  if (error) {
    console.error("[admin] updatePaymentSettings failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "settings.payment", parsed.data.method, { notifyEmails: emails });

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/deposit");
  return { success: true, message: "Payment settings saved." };
}


// ─────────────────────────────────────────────────────────────────────────────
// LIMITS, FEES AND THE TWO SERVICE SWITCHES
//
// What this writes is only data: the rules that read it live in SQL, inside
// the same transactions that move money, so a value saved here binds the next
// transfer whether it comes from our form or from a crafted request.
//
// Checkboxes are absent from the form data when unticked, which is how HTML
// works and is also how a switch gets turned off by accident if you read the
// field as a string. Hence the explicit === "on".
// ─────────────────────────────────────────────────────────────────────────────
export async function updateMoneySettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const parsed = MoneySettingsSchema.safeParse({
    transferMinAmount: formData.get("transferMinAmount"),
    transferMaxAmount: formData.get("transferMaxAmount"),
    transferMaxPerDay: formData.get("transferMaxPerDay"),
    transferMaxPerHour: formData.get("transferMaxPerHour"),
    transferMaxLookupsHour: formData.get("transferMaxLookupsHour"),
    transferFee: formData.get("transferFee"),
    withdrawalFee: formData.get("withdrawalFee"),
    transfersEnabled: formData.get("transfersEnabled") === "on",
    withdrawalsEnabled: formData.get("withdrawalsEnabled") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const now = new Date().toISOString();
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("app_settings").upsert([
    { key: MONEY_KEYS.transferMinAmount, value: String(d.transferMinAmount), updated_at: now },
    { key: MONEY_KEYS.transferMaxAmount, value: String(d.transferMaxAmount), updated_at: now },
    { key: MONEY_KEYS.transferMaxPerDay, value: String(d.transferMaxPerDay), updated_at: now },
    { key: MONEY_KEYS.transferMaxPerHour, value: String(d.transferMaxPerHour), updated_at: now },
    {
      key: MONEY_KEYS.transferMaxLookupsHour,
      value: String(d.transferMaxLookupsHour),
      updated_at: now,
    },
    { key: MONEY_KEYS.transferFee, value: String(d.transferFee), updated_at: now },
    { key: MONEY_KEYS.withdrawalFee, value: String(d.withdrawalFee), updated_at: now },
    { key: SWITCH_KEYS.transfersEnabled, value: d.transfersEnabled ? "1" : "0", updated_at: now },
    {
      key: SWITCH_KEYS.withdrawalsEnabled,
      value: d.withdrawalsEnabled ? "1" : "0",
      updated_at: now,
    },
  ]);

  if (error) {
    console.error("[admin] updateMoneySettings failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  // Audited in full. Turning withdrawals off is the single most disruptive
  // thing an admin can do without touching an account, and "who stopped them,
  // and when" needs an answer that is not somebody's memory.
  await audit(user.id, "settings.money", d.transfersEnabled && d.withdrawalsEnabled ? "all_on" : "paused", {
    ...d,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/dashboard/transfer");
  revalidatePath("/dashboard/payouts");

  return { success: true, message: "Limits, fees and switches saved." };
}
// ─────────────────────────────────────────────────────────────────────────────
// BANK LOOKUP FOR THE COMPANY ACCOUNT
//
// Same Korapay resolve the user-side form uses, minus the profile name check:
// this is Rydvest's own account, so the name that comes back is "RYDVEST LTD",
// not the admin's. Lookup is a convenience here, not a security control — the
// settings are written by an admin either way.
// ─────────────────────────────────────────────────────────────────────────────
export async function listBanksForAdmin(): Promise<Bank[]> {
  await requireAdmin();
  const { banks } = await monnifyListBanks();
  return banks;
}

export type CompanyAccountLookup =
  | { status: "ok"; accountName: string; bankName?: string }
  | { status: "not_found" | "unavailable"; message: string };

export async function resolveCompanyAccount(
  bankCode: string,
  accountNumber: string
): Promise<CompanyAccountLookup> {
  await requireAdmin();

  if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
    return { status: "not_found", message: ERRORS.ACCOUNT_NUMBER_INVALID };
  }

  const resolved = await monnifyValidateAccount(bankCode, accountNumber);
  if (resolved.status === "unavailable") {
    return { status: "unavailable", message: ERRORS.ACCOUNT_LOOKUP_UNAVAILABLE };
  }
  if (resolved.status !== "ok" || !resolved.accountName) {
    return { status: "not_found", message: ERRORS.ACCOUNT_NOT_FOUND };
  }

  return { status: "ok", accountName: resolved.accountName, bankName: resolved.bankName };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUTS
//
// Settlement is automatic (app/api/cron/payouts), so these are the exceptions:
// running the settlement by hand, and taking back a payout that should not
// have gone out.
// ─────────────────────────────────────────────────────────────────────────────
export async function settleDuePayouts(_prev: FormState): Promise<FormState> {
  const { user } = await requireAdmin();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("settle_due_payouts");

  if (error) {
    console.error("[admin] settle_due_payouts failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as { count?: number; total?: number } | null;
  const count = Number(result?.count ?? 0);

  await audit(user.id, "payout.settle_due", "manual", { count, total: result?.total });
  revalidatePath("/admin/payouts");
  revalidatePath("/admin");

  return {
    success: true,
    message:
      count === 0
        ? "Nothing was due — everything is already settled."
        : `Settled ${count} payout${count === 1 ? "" : "s"} totalling ${fmtNaira(Number(result?.total ?? 0))}.`,
  };
}

export async function revertPayout(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return { message: ERRORS.ADMIN_ACTION_FAILED };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return { errors: { reason: ERRORS.PAYOUT_REASON_REQUIRED } };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("revert_payout", {
    p_payout_id: payoutId,
    p_admin_id: user.id,
    p_reason: reason,
  });

  if (error) {
    console.error("[admin] revert_payout failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as
    | { ok?: boolean; reason?: string; amount?: number; balance_after?: number }
    | null;
  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "payout.revert", payoutId, { amount: result.amount, reason });
  revalidatePath("/admin/payouts");
  revalidatePath("/admin");

  const balance = Number(result.balance_after ?? 0);
  return {
    success: true,
    message:
      balance < 0
        ? `Reverted ${fmtNaira(Number(result.amount ?? 0))}. This user's balance is now ${fmtNaira(balance)} — they had already withdrawn some of it.`
        : `Reverted ${fmtNaira(Number(result.amount ?? 0))}.`,
  };
}

export async function restorePayout(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return { message: ERRORS.ADMIN_ACTION_FAILED };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("restore_payout", {
    p_payout_id: payoutId,
    p_admin_id: user.id,
  });

  if (error) {
    console.error("[admin] restore_payout failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "payout.restore", payoutId);
  revalidatePath("/admin/payouts");
  return { success: true, message: "Back in the queue — it will settle on its due date." };
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ADMINISTRATION
//
// Every action here re-checks requireAdmin(), and refuses to act on another
// admin or on yourself. Locking your own account, or the only other admin,
// would leave nobody able to undo it.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared guard: returns the target profile, or a message explaining the no. */
async function targetUser(actorId: string, userId: string) {
  if (!userId) return { error: ERRORS.ADMIN_USER_NOT_FOUND };
  if (userId === actorId) return { error: ERRORS.ADMIN_NOT_ON_SELF };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, role, locked_at")
    .eq("id", userId)
    .single();

  if (!profile) return { error: ERRORS.ADMIN_USER_NOT_FOUND };
  if (profile.role === "admin") return { error: ERRORS.ADMIN_NOT_ON_ADMIN };

  return { profile };
}

export async function lockUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

  if (!reason) return { errors: { reason: ERRORS.ADMIN_LOCK_REASON_REQUIRED } };

  const { profile, error: guard } = await targetUser(user.id, userId);
  if (guard || !profile) return { message: guard };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ locked_at: new Date().toISOString(), locked_by: user.id, lock_reason: reason })
    .eq("id", userId);

  if (error) {
    console.error("[admin] lockUser failed", error.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "user.lock", userId, { reason });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true, message: `${profile.full_name ?? "Account"} is locked.` };
}

export async function unlockUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  const { profile, error: guard } = await targetUser(user.id, userId);
  if (guard || !profile) return { message: guard };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ locked_at: null, locked_by: null, lock_reason: null })
    .eq("id", userId);

  if (error) {
    console.error("[admin] unlockUser failed", error.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "user.unlock", userId);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true, message: `${profile.full_name ?? "Account"} can sign in again.` };
}

/**
 * Permanently removes an account — but only one that has never touched money.
 *
 * Deleting a user with investments, deposits, payouts or withdrawals would
 * either break the foreign keys those records depend on or, worse, take the
 * records with it. The ledger has to stay whole: those accounts get locked
 * instead, which stops the account being used while keeping every row that
 * explains where the money went.
 */
export async function deleteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const typed = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();

  const { profile, error: guard } = await targetUser(user.id, userId);
  if (guard || !profile) return { message: guard };

  // Typing the address is the only thing standing between a stray click and a
  // permanent deletion.
  if (typed !== (profile.email ?? "").toLowerCase()) {
    return { errors: { confirmEmail: ERRORS.ADMIN_DELETE_CONFIRM } };
  }

  const admin = createSupabaseAdminClient();
  const [inv, dep, pay, wd, txn, trfOut, trfIn] = await Promise.all([
    admin.from("investments").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("deposits").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("payouts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("withdrawals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    // Counted explicitly rather than left to the foreign key. Deleting one
    // side of a transfer would gut the other party's statement, and a clear
    // refusal beats a constraint violation.
    //
    // Two .eq() queries rather than one .or(): .or() takes a string, so the id
    // would be interpolated into a filter expression, and a crafted value
    // could add filters of its own. .eq() passes it as a value.
    admin.from("transfers").select("id", { count: "exact", head: true }).eq("sender_id", userId),
    admin.from("transfers").select("id", { count: "exact", head: true }).eq("recipient_id", userId),
  ]);

  const records =
    (inv.count ?? 0) +
    (dep.count ?? 0) +
    (pay.count ?? 0) +
    (wd.count ?? 0) +
    (txn.count ?? 0) +
    (trfOut.count ?? 0) +
    (trfIn.count ?? 0);

  if (records > 0) {
    return { message: ERRORS.ADMIN_DELETE_HAS_RECORDS };
  }

  // Remove the auth user; the profile row cascades from it.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[admin] deleteUser failed", authError.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await admin.from("profiles").delete().eq("id", userId);
  await audit(user.id, "user.delete", userId, { email: profile.email });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY VERIFICATION — approve or turn down a submission.
//
// Approving is what actually unlocks withdrawals: request_withdrawal() in the
// database looks for an approved row and refuses without one.
//
// Both decisions email the user, because they were told they would hear back.
// ─────────────────────────────────────────────────────────────────────────────

/** Loads a submission that is still awaiting a decision, with its user. */
async function pendingSubmission(submissionId: string) {
  if (!submissionId) return { error: ERRORS.ADMIN_KYC_NOT_FOUND };

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("kyc_submissions")
    .select("id, user_id, status, profiles!kyc_submissions_user_id_fkey(full_name, email)")
    .eq("id", submissionId)
    .maybeSingle();

  if (!data) return { error: ERRORS.ADMIN_KYC_NOT_FOUND };
  if (data.status !== "pending") return { error: ERRORS.ADMIN_KYC_ALREADY_REVIEWED };

  const profile = data.profiles as unknown as { full_name: string | null; email: string } | null;
  return { submission: { id: data.id, userId: data.user_id, profile } };
}

/**
 * Tells the user what was decided.
 *
 * A rejection carries the admin's reason verbatim — that is the whole value of
 * the email. "Declined" with nothing attached just means the same photo comes
 * back again.
 */
async function emailDecision(
  to: string,
  name: string,
  outcome: "approved" | "rejected",
  reason?: string
) {
  const approved = outcome === "approved";
  const why = (reason ?? "").trim() || "No reason was recorded.";

  const res = await sendEmail({
    from: noReplyFrom(),
    to,
    subject: approved ? kycApprovedSubject : kycRejectedSubject,
    text: approved ? kycApprovedText(name) : kycRejectedText(name, why),
    html: approved ? kycApprovedHtml(name) : kycRejectedHtml(name, why),
  });
  if (!res.ok) console.error("[admin] kyc decision email failed", res.body);
}

export async function approveKyc(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const submissionId = String(formData.get("submissionId") ?? "");
  const found = await pendingSubmission(submissionId);
  if (found.error) return { message: found.error };
  const { submission } = found;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("kyc_submissions")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_note: null,
    })
    .eq("id", submission!.id)
    // Only move a row that is still pending, so two admins clicking at once
    // cannot both write a decision.
    .eq("status", "pending");

  if (error) {
    console.error("[admin] approveKyc failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "kyc.approve", submission!.id, { user_id: submission!.userId });
  revalidatePath("/admin/kyc");
  revalidatePath("/admin");

  if (submission!.profile?.email) {
    await emailDecision(
      submission!.profile.email,
      submission!.profile.full_name ?? "",
      "approved"
    );
  }

  return { success: true, message: "Verified — they can withdraw now." };
}

export async function rejectKyc(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const submissionId = String(formData.get("submissionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return { errors: { reason: ERRORS.ADMIN_KYC_REASON_REQUIRED } };

  const found = await pendingSubmission(submissionId);
  if (found.error) return { message: found.error };
  const { submission } = found;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("kyc_submissions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_note: reason,
    })
    .eq("id", submission!.id)
    .eq("status", "pending");

  if (error) {
    console.error("[admin] rejectKyc failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "kyc.reject", submission!.id, { user_id: submission!.userId, reason });
  revalidatePath("/admin/kyc");
  revalidatePath("/admin");

  if (submission!.profile?.email) {
    await emailDecision(
      submission!.profile.email,
      submission!.profile.full_name ?? "",
      "rejected",
      reason
    );
  }

  return { success: true, message: "Turned down — they have been told why." };
}

/**
 * Decrypts one ID number for an admin who is looking at the submission.
 *
 * Not rendered with the page on purpose. The number is only useful at the
 * moment of comparison, so it is fetched on demand and every fetch writes an
 * audit_log row naming the admin — which is the part that makes holding these
 * numbers defensible at all.
 */
export async function revealKycNumber(
  submissionId: string
): Promise<{ ok: true; idNumber: string } | { ok: false; message: string }> {
  const { user } = await requireAdmin();
  if (!submissionId) return { ok: false, message: ERRORS.ADMIN_KYC_NOT_FOUND };

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("kyc_submissions")
    .select("id, user_id, id_type, id_number_encrypted")
    .eq("id", submissionId)
    .maybeSingle();

  if (!data) return { ok: false, message: ERRORS.ADMIN_KYC_NOT_FOUND };

  let idNumber: string;
  try {
    // Bound to the owner at encryption time, so this also proves the
    // ciphertext has not been moved between rows.
    idNumber = decryptSecret(data.id_number_encrypted, data.user_id);
  } catch (err) {
    console.error("[admin] kyc decrypt failed", err instanceof Error ? err.message : err);
    return { ok: false, message: ERRORS.ADMIN_KYC_DECRYPT_FAILED };
  }

  await audit(user.id, "kyc.reveal", submissionId, {
    user_id: data.user_id,
    id_type: data.id_type,
  });

  return { ok: true, idNumber };
}

/**
 * Re-runs the NIMC lookup on a submission whose check did not complete.
 *
 * Exists because the usual reason a check fails is a flat Monnify wallet, and
 * making the user resubmit their NIN and selfie over our billing problem would
 * be absurd. Each run is billed, so it is a deliberate button, not a retry
 * loop.
 */
export async function recheckKycNin(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return { message: ERRORS.ADMIN_KYC_NOT_FOUND };

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("kyc_submissions")
    .select(
      "id, user_id, id_number_encrypted, lookup_status, lookup_at, profiles!kyc_submissions_user_id_fkey(full_name)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!data) return { message: ERRORS.ADMIN_KYC_NOT_FOUND };

  // A check in flight is left alone — but only while it is plausibly still
  // running. If the request that started it died (a deploy mid-flight, a cold
  // start killed), the row would otherwise sit at 'checking' forever with
  // nothing able to move it.
  if (data.lookup_status === "checking" && !lookupIsStale(data.lookup_at)) {
    return { message: ERRORS.ADMIN_KYC_LOOKUP_RUNNING };
  }

  let nin: string;
  try {
    nin = decryptSecret(data.id_number_encrypted, data.user_id);
  } catch (err) {
    console.error("[admin] kyc recheck decrypt failed", err instanceof Error ? err.message : err);
    return { message: ERRORS.ADMIN_KYC_DECRYPT_FAILED };
  }

  await admin
    .from("kyc_submissions")
    .update({
      lookup_status: "checking",
      lookup_error: null,
      lookup_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  const profile = data.profiles as unknown as { full_name: string | null } | null;
  await runNinLookup(submissionId, data.user_id, nin, profile?.full_name ?? "");

  await audit(user.id, "kyc.recheck", submissionId, { user_id: data.user_id });

  const { data: after } = await admin
    .from("kyc_submissions")
    .select("lookup_status")
    .eq("id", submissionId)
    .maybeSingle();

  revalidatePath("/admin/kyc");

  if (after?.lookup_status === "failed") {
    return { message: ERRORS.ADMIN_KYC_LOOKUP_FAILED };
  }
  return { success: true, message: "Checked." };
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND ONE PERSON OUT OF A POOL
//
// For "I've changed my mind, can I have my money back" on a pool that is still
// filling. Their contribution returns to their Rydvest balance; everyone else
// in the pool is untouched and the pool stays open.
//
// All of the money logic lives in refund_investment() so it happens in one
// transaction under a lock on the pool — this only checks who is asking and
// says what happened.
// ─────────────────────────────────────────────────────────────────────────────
export async function refundInvestment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user } = await requireAdmin();

  const investmentId = String(formData.get("investmentId") ?? "");
  if (!investmentId) return { message: ERRORS.ADMIN_ACTION_FAILED };

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return { errors: { reason: ERRORS.REFUND_REASON_REQUIRED } };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("refund_investment", {
    p_investment_id: investmentId,
    p_admin_id: user.id,
    p_reason: reason,
  });

  if (error) {
    console.error("[admin] refund_investment failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const result = data as
    | { ok?: boolean; reason?: string; amount?: number; user_id?: string }
    | null;

  if (!result?.ok) {
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "investment.refund", investmentId, {
    amount: result.amount,
    user_id: result.user_id,
    reason,
  });

  revalidatePath("/admin/investments");
  revalidatePath("/admin/pools");
  revalidatePath("/admin");

  return {
    success: true,
    message: `Refunded ${fmtNaira(Number(result.amount ?? 0))} to their Rydvest balance.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WHICH PROVIDER VERIFIES A NIN
//
// Its own action rather than a field on the payment form: this is the switch
// somebody reaches for when verifications start failing, and it should not be
// buried in a form about bank account numbers. Takes effect on the next
// lookup — including the "run it again" button on a submission that already
// failed, which is how an admin recovers the ones lost during an outage.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateNinProvider(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const provider = String(formData.get("provider") ?? "");
  if (!isNinProvider(provider)) return { message: ERRORS.ADMIN_ACTION_FAILED };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert([{ key: NIN_PROVIDER_KEY, value: provider, updated_at: new Date().toISOString() }]);

  if (error) {
    console.error("[admin] updateNinProvider failed", error);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "settings.nin_provider", provider);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/kyc");

  return {
    success: true,
    message: `Identity checks now run through ${provider === "korapay" ? "Korapay" : "Monnify"}.`,
  };
}
