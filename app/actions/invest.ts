"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INVESTING & POOLS — server actions.
 *
 * Money-flow security:
 *   • The user id ALWAYS comes from the verified session (requireUser),
 *     never from a form field.
 *   • Amounts are validated here against the pool's live state, and then
 *     re-verified to the kobo when Paystack confirms payment (webhook →
 *     apply_paid_investment in SQL). Nothing counts until Paystack + the
 *     database agree.
 *   • Financial writes use the admin client AFTER the checks — users have no
 *     direct write access to these tables (see supabase/schema.sql).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { paystackInitialize, generatePaymentReference } from "@/lib/paystack";
import { ERRORS } from "@/lib/errors";
import { InvestSchema, CreatePoolSchema, JoinByInviteSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// START AN INVESTMENT → creates a pending investment and sends the user to
// Paystack's hosted checkout. The investment only counts once the webhook
// confirms the charge.
// ─────────────────────────────────────────────────────────────────────────────
export async function startInvestment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = InvestSchema.safeParse({
    poolId: formData.get("poolId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { poolId, amount } = parsed.data;
  const admin = createSupabaseAdminClient();

  // Load the pool and its product. Admin client: an invited friend may not
  // pass the RLS member check yet — access is validated explicitly below.
  const { data: pool } = await admin
    .from("pools")
    .select("id, status, amount_raised, is_private, product:pool_products(id, active, target_amount, min_contribution)")
    .eq("id", poolId)
    .single();

  const product = pool?.product as unknown as {
    id: string; active: boolean; target_amount: number; min_contribution: number;
  } | null;

  if (!pool || !product) return { message: ERRORS.POOL_NOT_FOUND };
  if (pool.status !== "open") return { message: ERRORS.POOL_NOT_OPEN };
  if (!product.active) return { message: ERRORS.POOL_PRODUCT_INACTIVE };

  const remaining = Number(product.target_amount) - Number(pool.amount_raised);
  if (amount > remaining) return { errors: { amount: ERRORS.POOL_AMOUNT_TOO_LARGE } };
  // Minimum applies unless the user is topping off the last slice of the pool.
  if (amount < Number(product.min_contribution) && amount !== remaining) {
    return { errors: { amount: ERRORS.POOL_AMOUNT_TOO_SMALL } };
  }

  // Create the pending investment with our unique Paystack reference.
  const reference = generatePaymentReference();
  const { error: insertError } = await admin.from("investments").insert({
    pool_id: poolId,
    user_id: user.id,
    amount,
    status: "pending_payment",
    paystack_reference: reference,
  });
  if (insertError) {
    console.error("[invest] insert failed", insertError);
    return { message: ERRORS.PAYMENT_INIT_FAILED };
  }

  // Hand off to Paystack. Amount is in KOBO.
  const init = await paystackInitialize({
    email: user.email,
    amountKobo: amount * 100,
    reference,
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/invest/callback`,
    metadata: { pool_id: poolId, user_id: user.id },
  });

  if (!init.ok || !init.authorizationUrl) {
    // Clean up the orphaned pending row so it doesn't clutter anything.
    await admin.from("investments").delete().eq("paystack_reference", reference);
    return { message: ERRORS.PAYMENT_INIT_FAILED };
  }

  redirect(init.authorizationUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE A POOL — any user can open a new pool from an active product
// (e.g. a private pool to fill with friends). Private pools get an invite code.
// ─────────────────────────────────────────────────────────────────────────────
export async function createPool(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = CreatePoolSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    isPrivate: formData.get("isPrivate") ?? "false",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const admin = createSupabaseAdminClient();

  const { data: product } = await admin
    .from("pool_products")
    .select("id, active")
    .eq("id", parsed.data.productId)
    .single();
  if (!product || !product.active) return { message: ERRORS.POOL_PRODUCT_INACTIVE };

  // 8-char alphanumeric invite code for private pools, e.g. "7F3KQ2ZP".
  const inviteCode = parsed.data.isPrivate
    ? crypto.randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase().padEnd(8, "0")
    : null;

  const { data: created, error } = await admin
    .from("pools")
    .insert({
      product_id: product.id,
      name: parsed.data.name,
      created_by: user.id,
      is_private: parsed.data.isPrivate,
      invite_code: inviteCode,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[pool] create failed", error);
    return { message: ERRORS.POOL_CREATE_FAILED };
  }

  revalidatePath("/dashboard/pools");
  redirect(`/dashboard/pools/${created.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// JOIN A PRIVATE POOL BY INVITE CODE — resolves the code to the pool page.
// ─────────────────────────────────────────────────────────────────────────────
export async function joinByInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();

  const parsed = JoinByInviteSchema.safeParse({ inviteCode: formData.get("inviteCode") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const admin = createSupabaseAdminClient();
  const { data: pool } = await admin
    .from("pools")
    .select("id, status")
    .eq("invite_code", parsed.data.inviteCode)
    .single();

  if (!pool) return { errors: { inviteCode: ERRORS.POOL_INVITE_INVALID } };
  if (pool.status !== "open") return { message: ERRORS.POOL_NOT_OPEN };

  // The code itself grants access to the private pool page.
  redirect(`/dashboard/pools/${pool.id}?code=${encodeURIComponent(parsed.data.inviteCode)}`);
}
