"use client";

/**
 * VERIFY OTP — the user types the 6-digit code emailed by Supabase Auth.
 * The email arrives via the ?email= query param (set by signup/login).
 * Verification and resending both go through server actions; on success the
 * server action logs the user in and redirects to /dashboard.
 */
import Link from "next/link";
import { Suspense, useState, useRef, useEffect, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyOtp, resendOtp, type FormState } from "@/app/actions/auth";
import { AuthShell, ErrorBanner, SuccessBanner } from "@/components/auth/shared";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

function OtpForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [verifyState, verifyAction, verifying] = useActionState<FormState, FormData>(verifyOtp, undefined);
  const [resendState, resendAction, resending] = useActionState<FormState, FormData>(resendOtp, undefined);

  const code = otp.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer === 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Restart the resend cooldown after a successful resend.
  useEffect(() => {
    if (resendState?.success) setTimer(RESEND_SECONDS);
  }, [resendState]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
    if (val && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const updated = [...pasted.split(""), ...Array(OTP_LENGTH).fill("")].slice(0, OTP_LENGTH);
    setOtp(updated);
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  // No email in the URL → we can't verify anything; send them back.
  if (!email) {
    return (
      <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7 text-center">
        <p className="text-sm text-slate-400 mb-4">
          We couldn't tell which email to verify.
        </p>
        <Link href="/register" className="text-amber-400 font-semibold text-sm hover:text-amber-300">
          Go back to registration →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
      <div className="text-center mb-7">
        <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-white mb-2">Check your email</h1>
        <p className="text-sm text-slate-400 leading-relaxed">We sent a 6-digit verification code to</p>
        <p className="text-sm text-white font-semibold mt-1">{email}</p>
      </div>

      <form action={verifyAction}>
        {/* The verified email + assembled code travel as hidden fields. */}
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={code} />

        <div className="flex gap-2.5 justify-center mb-5" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              style={{ height: 52 }}
              className={`w-11 text-center text-xl font-bold rounded-xl border transition-all duration-150 outline-none bg-white/5 text-white
                ${verifyState?.message
                  ? "border-red-500 bg-red-500/5"
                  : digit
                  ? "border-amber-400 bg-amber-400/8"
                  : "border-white/10 focus:border-amber-400"
                }`}
            />
          ))}
        </div>

        <ErrorBanner message={verifyState?.message} />
        <SuccessBanner message={resendState?.success ? resendState.message : undefined} />

        <button
          type="submit"
          disabled={verifying || code.length < OTP_LENGTH}
          className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mb-5 ${
            verifying || code.length < OTP_LENGTH
              ? "bg-amber-400/50 text-[#0d2137] cursor-not-allowed"
              : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
          }`}
        >
          {verifying ? "Verifying..." : "Verify email →"}
        </button>
      </form>

      <div className="text-center">
        {timer > 0 ? (
          <p className="text-sm text-slate-500">
            Resend code in{" "}
            <span className="text-amber-400 font-bold tabular-nums">
              0:{timer.toString().padStart(2, "0")}
            </span>
          </p>
        ) : (
          <form action={resendAction} className="inline">
            <input type="hidden" name="email" value={email} />
            <button type="submit" disabled={resending} className="text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors disabled:opacity-50">
              {resending ? "Sending..." : "Resend code"}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 mt-4">
        Wrong email?{" "}
        <Link href="/register" className="text-amber-400 hover:text-amber-300 transition-colors">Go back</Link>
      </p>
    </div>
  );
}

export default function OTPPage() {
  return (
    <AuthShell>
      {/* useSearchParams requires a Suspense boundary */}
      <Suspense fallback={null}>
        <OtpForm />
      </Suspense>
    </AuthShell>
  );
}
