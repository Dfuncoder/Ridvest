/**
 * Public endpoint for the headline interest rate shown on the landing page.
 * Reads from app_settings (key: interest_rate_percent) — change the number
 * in the admin database (or Supabase table editor) and the site follows.
 * Falls back to 50% if the database is unreachable.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  let percent = 50;

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "interest_rate_percent")
      .single();
    if (data?.value && !Number.isNaN(Number(data.value))) {
      percent = Number(data.value);
    }
  } catch {
    // Env not configured yet (e.g. first local run) — use the fallback.
  }

  return NextResponse.json({ rate: percent / 100, label: `${percent}% per pool` });
}
