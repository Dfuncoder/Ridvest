"use server";

/**
 * INVESTING & POOLS — server actions.
 *
 * Money-flow security:
 *   • The user id ALWAYS comes from the verified session (requireUser),
 *     never from a form field.
 *   • Joining a pool spends the user's Rydvest balance. Everything that
 *     matters — the balance, the pool's remaining room, the minimum, private
 *     pool access — is re-checked inside join_pool_from_balance() in SQL,
 *     under a row lock, so two concurrent joins can never overspend or
 *     overfill.
 *   • Financial writes use the admin client AFTER the checks — users have no
 *     direct write access to these tables (see supabase/schema.sql).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS, DB_REASON_TO_ERROR } from "@/lib/errors";
import { InvestSchema, CreatePoolSchema, JoinByInviteSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// JOIN A POOL — debits the balance and confirms the investment immediately.
// No payment is in flight, so a pool that fills first fails cleanly instead of
// leaving money stranded.
// ─────────────────────────────────────────────────────────────────────────────
export async function joinPool(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();

  const parsed = InvestSchema.safeParse({
    poolId: formData.get("poolId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_pool_from_balance", {
    p_pool_id: parsed.data.poolId,
    p_amount: parsed.data.amount,
  });

  if (error) {
    console.error("[invest] join_pool_from_balance failed", error);
    return { message: ERRORS.GENERIC };
  }

  const result = data as { ok?: boolean; reason?: string; pool_status?: string } | null;

  if (!result?.ok) {
    if (result?.reason === "insufficient_balance") {
      return { errors: { amount: ERRORS.INSUFFICIENT_BALANCE } };
    }
    if (result?.reason === "amount_too_large" || result?.reason === "amount_too_small") {
      return { errors: { amount: DB_REASON_TO_ERROR[result.reason] } };
    }
    return { message: DB_REASON_TO_ERROR[result?.reason ?? ""] ?? ERRORS.GENERIC };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invest");
  revalidatePath("/dashboard/portfolio");
  revalidatePath("/dashboard/wallet");

  return {
    success: true,
    message:
      result.pool_status === "active"
        ? "You're in — and that filled the pool. Your investment starts earning now."
        : "You're in. We'll let you know the moment this pool fills up.",
  };
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
