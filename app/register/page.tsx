"use client";

/**
 * REGISTER — collects exactly: full name, email, password + confirm,
 * date of birth, phone number, address + state of residence, and
 * agreement to Terms & Privacy. Submits to the `signup` server action,
 * which re-validates everything and sends the email OTP.
 *
 * The two visual steps are ONE <form>: step 1 stays mounted (just hidden)
 * so all fields are included when the form finally submits.
 */
import Link from "next/link";
import { useState, useActionState } from "react";
import { signup, type FormState } from "@/app/actions/auth";
import { NIGERIAN_STATES } from "@/lib/validation";
import {
  AuthShell, FieldIcon, icons, inputClass, labelClass,
  PasswordStrength, EyeToggle, ErrorBanner, FieldError,
} from "@/components/auth/shared";

const steps = ["Personal details", "Residence & consent"];

// Field → step mapping so a server-side error can bounce you back to step 1.
const STEP1_FIELDS = ["fullName", "email", "phone", "password", "confirmPassword"];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(signup, undefined);

  const errors = state?.errors ?? {};
  // If the server rejected a step-1 field while we're on step 2, tell the user.
  const step1HasError = STEP1_FIELDS.some((f) => errors[f]);

  return (
    <AuthShell>
      {/* Step bar */}
      <div className="mb-5">
        <div className="flex gap-1.5 mb-2">
          {steps.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{ background: i < step ? "#f59e0b" : "rgba(255,255,255,0.1)" }} />
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center">
          Step {step} of {steps.length} —{" "}
          <span className="font-semibold text-slate-300">{steps[step - 1]}</span>
        </p>
      </div>

      <form action={formAction}>
        {/* ── STEP 1 — Personal details (hidden, not unmounted, on step 2) ── */}
        <div className={step === 1 ? "bg-[#0f2e52] border border-white/10 rounded-2xl p-7" : "hidden"}>
          <h1 className="text-xl font-extrabold text-white mb-1">Create your account</h1>
          <p className="text-sm text-slate-400 mb-6">Start investing in minutes</p>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="fullName" className={labelClass}>Full name</label>
              <div className="relative">
                <FieldIcon path={icons.user} />
                <input id="fullName" name="fullName" type="text" placeholder="Jude Mbakwe" autoComplete="name" required className={inputClass} />
              </div>
              <FieldError message={errors.fullName} />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email address</label>
              <div className="relative">
                <FieldIcon path={icons.mail} />
                <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required className={inputClass} />
              </div>
              <FieldError message={errors.email} />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>Phone number</label>
              <div className="relative">
                <FieldIcon path={icons.phone} />
                <input id="phone" name="phone" type="tel" placeholder="+234 800 000 0000" autoComplete="tel" required className={inputClass} />
              </div>
              <FieldError message={errors.phone} />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>Password</label>
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
                  className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                />
                <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
              </div>
              <PasswordStrength password={password} />
              <FieldError message={errors.password} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm password</label>
              <div className="relative">
                <FieldIcon path={icons.lock} />
                <input id="confirmPassword" name="confirmPassword" type={showPwd ? "text" : "password"} placeholder="Repeat your password" autoComplete="new-password" required className={inputClass} />
              </div>
              <FieldError message={errors.confirmPassword} />
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mt-1"
            >
              Continue →
            </button>
          </div>
        </div>

        {/* ── STEP 2 — Residence & consent ── */}
        <div className={step === 2 ? "bg-[#0f2e52] border border-white/10 rounded-2xl p-7" : "hidden"}>
          <h1 className="text-xl font-extrabold text-white mb-1">Almost there</h1>
          <p className="text-sm text-slate-400 mb-5">A few details required to verify your identity</p>

          <ErrorBanner message={state?.message} />
          {step1HasError && (
            <ErrorBanner message="There's a problem with your details on step 1 — tap Back to fix it." />
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="dob" className={labelClass}>Date of birth</label>
              <div className="relative">
                <FieldIcon path={icons.calendar} />
                <input id="dob" name="dob" type="date" required className={inputClass} />
              </div>
              <FieldError message={errors.dob} />
            </div>

            <div>
              <label htmlFor="address" className={labelClass}>Home address</label>
              <div className="relative">
                <FieldIcon path={icons.home} />
                <input id="address" name="address" type="text" placeholder="12 Zik Avenue, Awka" autoComplete="street-address" required className={inputClass} />
              </div>
              <FieldError message={errors.address} />
            </div>

            <div>
              <label htmlFor="state" className={labelClass}>State of residence</label>
              <div className="relative">
                <FieldIcon path={icons.pin} />
                <select id="state" name="state" required defaultValue="" className={`${inputClass} appearance-none bg-[#0f2e52]`}>
                  <option value="" disabled>Select your state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-[#0f2e52]">{s}</option>
                  ))}
                </select>
              </div>
              <FieldError message={errors.state} />
            </div>

            <label className="flex items-start gap-3 cursor-pointer mt-1">
              <input
                type="checkbox"
                name="agreedToTerms"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-amber-400"
              />
              <span className="text-xs text-slate-400 leading-relaxed">
                I agree to Rydvest's{" "}
                <Link href="/terms" className="text-amber-400 hover:text-amber-300 transition-colors">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-amber-400 hover:text-amber-300 transition-colors">Privacy Policy</Link>.
                I confirm that all details provided are accurate.
              </span>
            </label>
            <FieldError message={errors.agreedToTerms} />

            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => setStep(1)} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
                ← Back
              </button>
              <button
                type="submit"
                disabled={!agreed || pending}
                className={`flex-1 py-3 font-extrabold text-sm rounded-xl transition-all duration-150 ${
                  agreed && !pending
                    ? "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] shadow-lg shadow-amber-400/20"
                    : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5"
                }`}
              >
                {pending ? "Creating account..." : "Create account →"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500 mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
