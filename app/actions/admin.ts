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
import { ERRORS } from "@/lib/errors";
import { PoolProductSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

/** Writes one audit trail row for an admin action. */
async function audit(actorId: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({ actor_id: actorId, action, target, detail });
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL PRODUCTS — the investment options (e.g. "Keke Napep", price, months, ROI)
// ─────────────────────────────────────────────────────────────────────────────
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const parsed = PoolProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    targetAmount: formData.get("targetAmount"),
    minContribution: formData.get("minContribution"),
    durationMonths: formData.get("durationMonths"),
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
      duration_months: parsed.data.durationMonths,
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
// The actual refund is issued from the Paystack dashboard; this records it.
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
    .select("id, paystack_reference")
    .single();

  if (!updated) return;

  await admin
    .from("transactions")
    .update({ status: "success" })
    .eq("reference", updated.paystack_reference)
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
