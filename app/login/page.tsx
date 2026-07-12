"use client";

/**
 * LOGIN — submits to the `login` server action.
 * Shows a success note after a password reset (?reset=1) and the vague
 * "incorrect email or password" message on failure (no account probing).
 */
import Link from "next/link";
import { Suspense, useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type FormState } from "@/app/actions/auth";
import {
  AuthShell, FieldIcon, icons, inputClass, labelClass,
  EyeToggle, ErrorBanner, SuccessBanner,
} from "@/components/auth/shared";

function LoginForm() {
  const [showPwd, setShowPwd] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(login, undefined);
  const searchParams = useSearchParams();
  const justReset = searchParams.get("reset") === "1";

  return (
    <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
      <h1 className="text-xl font-extrabold text-white mb-1">Welcome back</h1>
      <p className="text-sm text-slate-400 mb-6">Login to your Rydvest account</p>

      {justReset && <SuccessBanner message="Password updated. Log in with your new password." />}
      <ErrorBanner message={state?.message} />

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className={labelClass}>Email address</label>
          <div className="relative">
            <FieldIcon path={icons.mail} />
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <div className="relative">
            <FieldIcon path={icons.lock} />
            <input
              id="password"
              name="password"
              type={showPwd ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
            />
            <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
          </div>
          <div className="text-right mt-2">
            <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mt-1 ${
            pending
              ? "bg-amber-400/50 text-[#0d2137] cursor-not-allowed"
              : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
          }`}
        >
          {pending ? "Logging in..." : "Login to Rydvest →"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      {/* useSearchParams requires a Suspense boundary */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-slate-500 mt-5">
        Don't have an account?{" "}
        <Link href="/register" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
          Create one →
        </Link>
      </p>
    </AuthShell>
  );
}
