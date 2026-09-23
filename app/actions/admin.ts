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

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, supportFrom, supportEmail } from "@/lib/email";
import { parseEmailList } from "@/lib/settings";
import { fmtNaira } from "@/lib/format";
import { receiptSubject, receiptText, receiptHtml, type Receipt } from "@/lib/receipt";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { PoolProductSchema, PaymentSettingsSchema, fieldErrors } from "@/lib/validation";
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
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.minContribution > parsed.data.targetAmount) {
    return { errors: { minContribution: ERRORS.ADMIN_PRODUCT_INVALID } };
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

  const { count } = await admin
    .from("pools")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { data: pool } = await admin
    .from("pools")
    .insert({
      product_id: productId,
      name: `${product.name} Pool #${(count ?? 0) + 1}`,
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
// PAYOUTS — marking a payout paid credits the user's withdrawable balance
// ─────────────────────────────────────────────────────────────────────────────
export async function markPayoutPaid(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return;

  const admin = createSupabaseAdminClient();
  // Guard on current status so a double-click can't double-credit.
  const { data: updated } = await admin
    .from("payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payoutId)
    .eq("status", "scheduled")
    .select("id, user_id, amount, pool_id")
    .single();

  if (!updated) return;

  await admin.from("transactions").insert({
    user_id: updated.user_id,
    type: "payout",
    amount: updated.amount,
    reference: updated.id,
    status: "success",
    metadata: { pool_id: updated.pool_id },
  });
  await audit(user.id, "payout.mark_paid", payoutId, { amount: updated.amount });
  revalidatePath("/admin/payouts");
}

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
  const admin = createSupabaseAdminClient();
  const { data: updated } = await admin
    .from("withdrawals")
    .update({
      status: to,
      admin_note: note ?? null,
      processed_at: to === "approved" ? null : new Date().toISOString(),
    })
    .eq("id", withdrawalId)
    .in("status", from)
    .select("id, user_id, amount")
    .single();

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
        from: supportFrom(),
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
