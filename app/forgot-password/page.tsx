"use client";

/**
 * FORGOT PASSWORD — submits to the `forgotPassword` server action, which
 * emails a reset link. The success message is IDENTICAL whether or not the
 * account exists, so the form can't be used to probe for registered emails.
 */
import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { forgotPassword, type FormState } from "@/app/actions/auth";
import {
  AuthShell, FieldIcon, icons, inputClass, labelClass, ErrorBanner, FieldError,
} from "@/components/auth/shared";
import { ERRORS } from "@/lib/errors";

function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(forgotPassword, undefined);
  const searchParams = useSearchParams();
  // Set when an emailed reset link was invalid/expired (see app/auth/confirm).
  const linkError = searchParams.get("error") === "invalid_link";

  if (state?.success) {
    return (
      <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-white mb-2">Check your inbox</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{state.message}</p>
        <Link href="/login" className="inline-block mt-6 text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors">
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
      <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <h1 className="text-xl font-extrabold text-white mb-1">Forgot your password?</h1>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        No problem. Enter the email address linked to your Rydvest account and we'll send you a reset link.
      </p>

      {linkError && <ErrorBanner message={ERRORS.RESET_LINK_INVALID} />}

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className={labelClass}>Email address</label>
          <div className="relative">
            <FieldIcon path={icons.mail} />
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required className={inputClass} />
          </div>
          <FieldError message={state?.errors?.email} />
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
          {pending ? "Sending..." : "Send reset link →"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-5">
        Remembered it?{" "}
        <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
          Back to login
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      {/* useSearchParams requires a Suspense boundary */}
      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
