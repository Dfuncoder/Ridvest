/**
 * Settles every payout that has reached its due date.
 *
 * Called on a schedule (see vercel.json). Vercel signs its own cron requests
 * with CRON_SECRET; anything else must present the same value as a bearer
 * token. Without the secret configured the endpoint refuses outright rather
 * than running money movement for anyone who finds the URL.
 *
 * Safe to call repeatedly: settle_due_payouts() only touches rows still
 * 'scheduled', so a retry, an overlapping run or a manual trigger from the
 * admin page cannot pay anyone twice.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to settle payouts");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("settle_due_payouts");

  if (error) {
    console.error("[cron] settle_due_payouts failed", error.message);
    // 500 so the platform retries rather than recording a successful no-op.
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }

  const result = data as { count?: number; total?: number } | null;
  console.log(`[cron] settled ${result?.count ?? 0} payouts totalling ${result?.total ?? 0}`);

  return NextResponse.json({ ok: true, ...result });
}
