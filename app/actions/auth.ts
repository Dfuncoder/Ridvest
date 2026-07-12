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
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/errors";
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
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // Same vague message for bad input and bad credentials — no account probing.
  if (!parsed.success) return { message: ERRORS.AUTH_INVALID_LOGIN };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Registered but never confirmed the email → push them through OTP again.
    if (error.code === "email_not_confirmed") {
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      redirect(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`);
    }
    if (error.status === 429) return { message: ERRORS.AUTH_RATE_LIMITED };
    return { message: ERRORS.AUTH_INVALID_LOGIN };
  }

  // Route by role (RLS lets the user read their own profile row).
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims?.claims?.sub ?? "")
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
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
