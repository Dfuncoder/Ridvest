"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

function Logo() {
  return (
    <Link href="/" className="flex flex-col items-center gap-3 mb-8">
      <svg width="48" height="48" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#1a3a5c" />
        <rect x="6" y="14" width="22" height="12" rx="4" fill="#2563a8" />
        <rect x="4" y="10" width="26" height="7" rx="3" fill="#3b82f6" />
        <rect x="24" y="14" width="4" height="12" rx="2" fill="#f59e0b" />
        <circle cx="9" cy="27" r="4" fill="#0d2137" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="9" cy="27" r="1.5" fill="#f59e0b" />
        <circle cx="27" cy="27" r="4" fill="#0d2137" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="27" cy="27" r="1.5" fill="#f59e0b" />
        <circle cx="30" cy="11" r="5" fill="#f59e0b" />
        <text x="30" y="14" textAnchor="middle" fontSize="6" fontWeight="700" fill="#1a3a5c" fontFamily="system-ui">₦</text>
      </svg>
      <div className="text-center">
        <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
          Rid<span className="text-amber-400">vest</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 tracking-widest uppercase">Invest. Ride. Earn.</p>
      </div>
    </Link>
  );
}

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OTPPage() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Replace with the actual email from your auth context or query param
  const email = "j***@example.com";

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (timer === 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    setError(false);
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
    if (val && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
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

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) { setError(true); return; }
    setLoading(true);
    // Replace with your actual API call:
    // await fetch("/api/verify-otp", { method: "POST", body: JSON.stringify({ code }) })
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setVerified(true);
    setTimeout(() => router.push("/dashboard"), 1800);
  };

  const handleResend = () => {
    setTimer(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(""));
    setError(false);
    inputs.current[0]?.focus();
    // Call your resend OTP API here:
    // await fetch("/api/resend-otp", { method: "POST" })
  };

  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-8 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Logo />

        <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
          {!verified ? (
            <>
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h1 className="text-xl font-extrabold text-white mb-2">Check your email</h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  We sent a 6-digit verification code to
                </p>
                <p className="text-sm text-white font-semibold mt-1">{email}</p>
              </div>

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
                      ${error
                        ? "border-red-500 bg-red-500/5"
                        : digit
                        ? "border-amber-400 bg-amber-400/8"
                        : "border-white/10 focus:border-amber-400"
                      }`}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs text-red-400">Incorrect code. Please check your email and try again.</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading}
                className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mb-5 ${
                  loading
                    ? "bg-amber-400/50 text-[#0d2137] cursor-not-allowed"
                    : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
                }`}
              >
                {loading ? "Verifying..." : "Verify email →"}
              </button>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-sm text-slate-500">
                    Resend code in{" "}
                    <span className="text-amber-400 font-bold tabular-nums">
                      0:{timer.toString().padStart(2, "0")}
                    </span>
                  </p>
                ) : (
                  <button onClick={handleResend} className="text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors">
                    Resend code
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-slate-600 mt-4">
                Wrong email?{" "}
                <Link href="/register" className="text-amber-400 hover:text-amber-300 transition-colors">Go back</Link>
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">Email verified!</h2>
              <p className="text-sm text-slate-400">Taking you to your dashboard...</p>
              <div className="flex justify-center gap-1 mt-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
