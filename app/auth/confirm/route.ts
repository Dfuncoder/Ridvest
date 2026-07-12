/**
 * Handles links from Supabase Auth emails (currently: password reset).
 *
 * Supabase sends the user to:
 *   /auth/confirm?token_hash=...&type=recovery&next=/reset-password
 *
 * We exchange the token_hash for a short-lived session (verifyOtp), then
 * forward to the `next` page. Invalid/expired tokens land back on
 * /forgot-password with an error flag.
 */
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Only allow redirecting to paths we own — never to an external URL that an
// attacker could smuggle into the `next` parameter (open-redirect protection).
const ALLOWED_NEXT = ["/reset-password", "/dashboard", "/login"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "/dashboard";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Bad or expired link.
  return NextResponse.redirect(new URL("/forgot-password?error=invalid_link", request.url));
}
