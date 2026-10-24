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
import { NIGERIAN_STATES, signupFieldError, type SignupField } from "@/lib/validation";
import {
  AuthShell, FieldIcon, icons, inputClass, labelClass,
  PasswordStrength, EyeToggle, ErrorBanner, FieldError, useStaleErrors,
} from "@/components/auth/shared";

const steps = ["Personal details", "Residence & consent"];

// Field → step mapping so a server-side error can bounce you back to step 1.
const STEP1_FIELDS: SignupField[] = [
  "fullName",
  "email",
  "phone",
  "password",
  "confirmPassword",
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(signup, undefined);

  const { errorFor, clearOn, message } = useStaleErrors(state);
  // If the server rejected a step-1 field while we're on step 2, tell the user.
  const step1HasError = STEP1_FIELDS.some((f) => errorFor(f));

  // ── Step 1, checked as it is typed ────────────────────────────────────────
  //
  // Every field on this step is controlled so the rule can run on each
  // keystroke. The alternative — finding out at the end that the phone number
  // was wrong — makes people retype a form they already filled in.
  //
  // A field only speaks up once it has something in it, or once it has been
  // left empty. Red text on a form nobody has touched yet is just shouting.
  const [values, setValues] = useState<Record<SignupField, string>>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [blurred, setBlurred] = useState<Partial<Record<SignupField, boolean>>>({});

  const liveError = (field: SignupField): string | null => {
    const value = values[field];
    if (!value) return blurred[field] ? signupFieldError(field, "", values.password) : null;
    return signupFieldError(field, value, values.password);
  };

  /** The server's complaint if there is one, otherwise ours. */
  const errorOn = (field: SignupField): string | undefined =>
    errorFor(field) ?? liveError(field) ?? undefined;

  const onField = (field: SignupField) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const next = e.target.value;
    setValues((prev) => ({ ...prev, [field]: next }));
    clearOn(field);
    // The two password boxes are one rule between them: typing in either can
    // fix or break the other, so both are re-checked together.
    if (field === "password") clearOn("confirmPassword");
    if (field === "confirmPassword") clearOn("password");
  };

  const markBlurred = (field: SignupField) => () =>
    setBlurred((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  // Nothing is missing and nothing is wrong — the only state Continue allows.
  const step1Ready = STEP1_FIELDS.every(
    (f) => values[f] && !signupFieldError(f, values[f], values.password)
  );

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
          <p className="text-sm text-slate-400 mb-6">Start earning in minutes</p>

          {/* Said before the first field rather than after a rejected form:
              the name and phone typed here are the ones checked against the
              ID later, and a mismatch only surfaces at verification, by which
              point the account is already waiting. */}
          <div className="mb-6 flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3.5 py-3">
            <svg
              className="h-5 w-5 shrink-0 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-xs leading-relaxed text-amber-200/90">
              Use your details{" "}
              <strong className="font-bold text-amber-300">
                exactly as they appear on your government-issued ID
              </strong>
              . Your name and phone are required for KYC verification — incorrect details will
              delay your account.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="fullName" className={labelClass}>Full name</label>
              <div className="relative">
                <FieldIcon path={icons.user} />
                <input id="fullName" name="fullName" type="text" placeholder="John Doe" autoComplete="name" required className={inputClass} value={values.fullName} onChange={onField("fullName")} onBlur={markBlurred("fullName")} />
              </div>
              <FieldError message={errorOn("fullName")} />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email address</label>
              <div className="relative">
                <FieldIcon path={icons.mail} />
                <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required className={inputClass} value={values.email} onChange={onField("email")} onBlur={markBlurred("email")} />
              </div>
              <FieldError message={errorOn("email")} />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>Phone number</label>
              <div className="relative">
                <FieldIcon path={icons.phone} />
                <input id="phone" name="phone" type="tel" placeholder="+234 800 000 0000" autoComplete="tel" required className={inputClass} value={values.phone} onChange={onField("phone")} onBlur={markBlurred("phone")} />
              </div>
              <FieldError message={errorOn("phone")} />
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
                  value={values.password}
                  onChange={onField("password")}
                  onBlur={markBlurred("password")}
                  autoComplete="new-password"
                  required
                  className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                />
                <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
              </div>
              <PasswordStrength password={values.password} />
              <FieldError message={errorOn("password")} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm password</label>
              <div className="relative">
                <FieldIcon path={icons.lock} />
                <input id="confirmPassword" name="confirmPassword" type={showPwd ? "text" : "password"} placeholder="Repeat your password" autoComplete="new-password" required className={inputClass} value={values.confirmPassword} onChange={onField("confirmPassword")} onBlur={markBlurred("confirmPassword")} />
              </div>
              <FieldError message={errorOn("confirmPassword")} />
            </div>

            {/* Dead until step 1 is actually right. The rules run on every
                keystroke above, so by the time this lights up there is nothing
                left for the server to reject on this step. */}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Ready}
              className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 mt-1 ${
                step1Ready
                  ? "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] shadow-lg shadow-amber-400/20"
                  : "bg-amber-400/40 text-[#0d2137]/70 cursor-not-allowed"
              }`}
            >
              Continue →
            </button>
          </div>
        </div>

        {/* ── STEP 2 — Residence & consent ── */}
        <div className={step === 2 ? "bg-[#0f2e52] border border-white/10 rounded-2xl p-7" : "hidden"}>
          <h1 className="text-xl font-extrabold text-white mb-1">Almost there</h1>
          <p className="text-sm text-slate-400 mb-5">A few details required to verify your identity</p>

          <ErrorBanner message={message} />
          {step1HasError && (
            <ErrorBanner message="There's a problem with your details on step 1 — tap Back to fix it." />
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="dob" className={labelClass}>Date of birth</label>
              <div className="relative">
                <FieldIcon path={icons.calendar} />
                <input id="dob" name="dob" type="date" required className={inputClass} onChange={() => clearOn("dob")} />
              </div>
              <FieldError message={errorFor("dob")} />
            </div>

            <div>
              <label htmlFor="address" className={labelClass}>Home address</label>
              <div className="relative">
                <FieldIcon path={icons.home} />
                <input id="address" name="address" type="text" placeholder="12 Zik Avenue, Awka" autoComplete="street-address" required className={inputClass} onChange={() => clearOn("address")} />
              </div>
              <FieldError message={errorFor("address")} />
            </div>

            <div>
              <label htmlFor="state" className={labelClass}>State of residence</label>
              <div className="relative">
                <FieldIcon path={icons.pin} />
                <select id="state" name="state" required defaultValue="" className={`${inputClass} appearance-none bg-[#0f2e52]`} onChange={() => clearOn("state")}>
                  <option value="" disabled>Select your state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-[#0f2e52]">{s}</option>
                  ))}
                </select>
              </div>
              <FieldError message={errorFor("state")} />
            </div>

            <label className="flex items-start gap-3 cursor-pointer mt-1">
              <input
                type="checkbox"
                name="agreedToTerms"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  clearOn("agreedToTerms");
                }}
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
            <FieldError message={errorFor("agreedToTerms")} />

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
