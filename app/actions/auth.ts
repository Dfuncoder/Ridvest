"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTH SERVER ACTIONS — signup, email OTP, login, logout, password reset.
 *
 * These run ONLY on the server. Security rules applied throughout:
 *   • Every input re-validated with Zod (lib/validation.ts) — the client
 *     forms are just UX; this is the real gate.
 *   • Error messages come from the catalog (lib/errors.ts) and are
 *     deliberately vague where account-probing is a risk.
 *   • Passwords never touch our database — Supabase Auth stores them hashed
 *     (bcrypt) on its side.
 *   • Supabase Auth applies its own rate limits to OTP sends and login
 *     attempts on top of what we do here.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createSupabaseCheckClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ERRORS } from "@/lib/errors";
import { safeNextPath } from "@/lib/redirects";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_TTL_MS,
  createChallenge,
  readChallenge,
  loginOtpDisabled,
} from "@/lib/login-challenge";
import {
  SignupSchema,
  LoginSchema,
  OtpSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  fieldErrors,
} from "@/lib/validation";

/** Shape returned to useActionState in the forms. */
export type FormState =
  | {
      /** Per-field messages, keyed by input name. */
      errors?: Record<string, string>;
      /** A general message shown at the top of the form. */
      message?: string;
      /** True when the action succeeded but we stay on the page. */
      success?: boolean;
    }
  | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP → sends a 6-digit OTP email, then redirects to /verify-otp
// ─────────────────────────────────────────────────────────────────────────────
export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  // 1. Validate everything server-side.
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    dob: formData.get("dob"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    state: formData.get("state"),
    agreedToTerms: formData.get("agreedToTerms"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { fullName, email, password, dob, phone, address, state } = parsed.data;

  // 2. Create the auth user. The profile metadata is copied into
  //    public.profiles by the handle_new_user trigger (supabase/schema.sql).
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        dob,
        address,
        state_of_residence: state,
      },
    },
  });

  if (error) {
    // Supabase rate limit or transient failure.
    if (error.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    return { message: ERRORS.SIGNUP_FAILED };
  }

  // With email confirmation enabled, signing up an ALREADY-REGISTERED email
  // returns a user with an empty identities array instead of an error
  // (that's Supabase's anti-enumeration behavior). Detect it here.
  if (data.user && data.user.identities?.length === 0) {
    return { errors: { email: ERRORS.SIGNUP_EMAIL_TAKEN } };
  }

  // 3. Off to OTP entry. The email travels in the query string (not secret).
  redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY OTP — confirms the email; on success the user is logged in
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = OtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) return { message: ERRORS.OTP_INVALID };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email", // verifies signup-confirmation email OTPs
  });

  if (error) return { message: ERRORS.OTP_INVALID };

  const { data: verified } = await supabase.auth.getClaims();
  const verifiedId = verified?.claims?.sub as string | undefined;
  if (verifiedId) await startIdleClock(verifiedId);

  redirect("/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP
// ─────────────────────────────────────────────────────────────────────────────
export async function resendOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { message: ERRORS.OTP_EMAIL_MISSING };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: email.data });

  if (error) return { message: ERRORS.OTP_RESEND_FAILED };
  return { success: true, message: "A new code has been sent to your email." };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN — redirects admins to /admin, everyone else to /dashboard
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Starts the idle clock for an account that has just authenticated.
 *
 * Signing in does not touch profiles.last_active_at by itself, so a user who
 * had been away longer than the idle window would authenticate successfully
 * and then be thrown straight back out by requireUser() — and again on the
 * next attempt, for ever. Stamping it here is what makes a fresh login mean a
 * fresh clock.
 *
 * Deliberately uses the service role and an explicit id rather than the
 * caller's session: if this write were to fail, the user would walk into that
 * same loop, so it must not depend on auth.uid() being readable in the moment
 * right after sign-in.
 */
async function startIdleClock(userId: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) console.error("[auth] could not start idle clock:", error.message);
  } catch (err) {
    // Never block a successful login over this; the idle check fails open too.
    console.error("[auth] could not start idle clock:", err);
  }
}
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  // Where the user was headed before the login wall (e.g. a transfer
  // confirmation link). Validated, never trusted verbatim.
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // Same vague message for bad input and bad credentials — no account probing.
  if (!parsed.success) return { message: ERRORS.AUTH_INVALID_LOGIN };

  // ── Step 1: the password ────────────────────────────────────────────────
  //
  // Checked with a client that does NOT persist the session, so a correct
  // password proves identity without signing the browser in. The session is
  // established only by the code step below.
  const check = createSupabaseCheckClient();
  const { error } = await check.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Registered but never confirmed the email → push them through OTP again.
    if (error.code === "email_not_confirmed") {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      redirect(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`);
    }
    if (error.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    return { message: ERRORS.AUTH_INVALID_LOGIN };
  }

  // That sign-in minted tokens nobody will use. Drop them rather than leave
  // a live refresh token behind for a session that never existed.
  await check.auth.signOut();

  // ── Locked accounts stop here ───────────────────────────────────────────
  //
  // Before the code is sent, not after: there is no reason to email a code to
  // an account that cannot be used.
  const service = createSupabaseAdminClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, locked_at, role")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (profile?.locked_at) return { message: ERRORS.ACCOUNT_LOCKED };

  // ── The escape hatch ────────────────────────────────────────────────────
  //
  // With LOGIN_OTP_DISABLED=1 the second step is skipped entirely and the
  // password alone signs them in — there to get everyone back in if email
  // delivery breaks.
  if (loginOtpDisabled()) {
    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) return { message: ERRORS.AUTH_INVALID_LOGIN };
    if (profile?.id) await startIdleClock(profile.id);
    if (next) redirect(next);
    redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
  }

  // ── Step 2: send the code ───────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Never create an account from this path; the password already proved one
    // exists. Without this a typo'd address could register somebody new.
    options: { shouldCreateUser: false },
  });

  if (otpError) {
    if (otpError.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    console.error("[auth] could not send login code", otpError.message);
    return { message: ERRORS.LOGIN_CODE_SEND_FAILED };
  }

  // The proof that the password step happened. Short-lived, signed, and
  // worthless on its own — see lib/login-challenge.ts.
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, createChallenge(parsed.data.email, next ?? ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
  });

  redirect("/verify-login");
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 OF LOGIN — the emailed code.
//
// The email comes from the signed challenge cookie, never from the form: a
// posted address could be swapped for somebody else's after the password step.
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyLoginOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const challenge = readChallenge(jar.get(CHALLENGE_COOKIE)?.value);
  if (!challenge) return { message: ERRORS.LOGIN_CHALLENGE_EXPIRED };

  const token = String(formData.get("token") ?? "").trim();
  if (!/^[0-9]{6}$/.test(token)) return { message: ERRORS.OTP_INVALID };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: challenge.email,
    token,
    type: "email",
  });

  if (error) {
    if (error.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    return { message: ERRORS.OTP_INVALID };
  }

  // Spent. Clearing it stops a second login being completed from the same
  // password check.
  jar.delete(CHALLENGE_COOKIE);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;

  // Re-checked after the session exists: an account locked during the minute
  // between password and code must not get in.
  if (userId) {
    const service = createSupabaseAdminClient();
    const { data: locked } = await service
      .from("profiles")
      .select("locked_at")
      .eq("id", userId)
      .single();

    if (locked?.locked_at) {
      await supabase.auth.signOut();
      return { message: ERRORS.ACCOUNT_LOCKED };
    }
  }

  if (userId) await startIdleClock(userId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId ?? "")
    .single();

  if (challenge.next) redirect(challenge.next);
  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEND THE LOGIN CODE
// ─────────────────────────────────────────────────────────────────────────────
export async function resendLoginOtp(_prev: FormState): Promise<FormState> {
  const jar = await cookies();
  const challenge = readChallenge(jar.get(CHALLENGE_COOKIE)?.value);
  if (!challenge) return { message: ERRORS.LOGIN_CHALLENGE_EXPIRED };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: challenge.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    if (error.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    return { message: ERRORS.OTP_RESEND_FAILED };
  }
  return { success: true, message: "A new code has been sent to your email." };
}


// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — emails a reset link
// ─────────────────────────────────────────────────────────────────────────────
export async function forgotPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  // The link lands on /auth/confirm which exchanges the token for a session,
  // then forwards to /reset-password where the new password is set.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });

  // ALWAYS report success, whether or not the account exists (no probing).
  return { success: true, message: ERRORS.FORGOT_PASSWORD_SENT };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD — requires the short-lived session from the emailed link
// ─────────────────────────────────────────────────────────────────────────────
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();

  // Only someone who clicked a valid, unexpired reset link has a session here.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { message: ERRORS.RESET_LINK_INVALID };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: ERRORS.RESET_PASSWORD_FAILED };

  // Force a fresh login with the new password.
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
