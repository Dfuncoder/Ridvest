/**
 * Handles links from Supabase Auth emails: password reset, and the signup
 * confirmation link for anyone who clicks it instead of typing the code.
 *
 * NOT login. Two-step login is completed on /verify-login, which enforces the
 * password challenge; see ALLOWED_TYPES below.
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

/**
 * Which kinds of email link may sign somebody in here.
 *
 * 'magiclink' is deliberately NOT on this list. Login is password first, then
 * a code entered on /verify-login, and that step does things a bare link
 * cannot: it checks the signed challenge proving the password was accepted,
 * re-checks the account was not locked in the meantime, and starts the idle
 * clock. A magic link would hand out a session while skipping all three.
 *
 * So if Supabase's Magic Link template still carries {{ .ConfirmationURL }},
 * clicking it does nothing rather than quietly bypassing the login flow.
 */
const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "signup", "email", "email_change"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const type = rawType && ALLOWED_TYPES.includes(rawType) ? rawType : null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "/dashboard";

  if (rawType && !type) {
    console.warn("[auth/confirm] refused link type", rawType);
  }

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
