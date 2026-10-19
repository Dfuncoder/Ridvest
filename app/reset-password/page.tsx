"use client";

/**
 * RESET PASSWORD — the user lands here from the emailed reset link
 * (via /auth/confirm, which established a short-lived session).
 * Submits to the `resetPassword` server action, which updates the password,
 * signs out, and redirects to /login?reset=1.
 */
import Link from "next/link";
import { useState, useActionState } from "react";
import { resetPassword, type FormState } from "@/app/actions/auth";
import {
  AuthShell, FieldIcon, icons, labelClass,
  PasswordStrength, EyeToggle, ErrorBanner, FieldError,
} from "@/components/auth/shared";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(resetPassword, undefined);

  const pwdInput =
    "w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors";

  return (
    <AuthShell>
      <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
        <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h1 className="text-xl font-extrabold text-white mb-1">Set a new password</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Choose a strong password you haven't used before.
        </p>

        <ErrorBanner message={state?.message} />

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className={labelClass}>New password</label>
            <div className="relative">
              <FieldIcon path={icons.lock} />
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={pwdInput}
              />
              <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
            </div>
            <PasswordStrength password={password} />
            <FieldError message={state?.errors?.password} />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>Confirm new password</label>
            <div className="relative">
              <FieldIcon path={icons.lock} />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPwd ? "text" : "password"}
                placeholder="Repeat your new password"
                autoComplete="new-password"
                required
                className={pwdInput}
              />
            </div>
            <FieldError message={state?.errors?.confirmPassword} />
          </div>

          <button
            type="submit"
            disabled={pending}
            className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 ${
              pending
                ? "bg-amber-400/50 text-[#0d2137] cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
            }`}
          >
            {pending ? "Updating..." : "Update password →"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
            ← Back to login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
