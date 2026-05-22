"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    // Replace with your API call:
    // await fetch("/api/forgot-password", { method: "POST", body: JSON.stringify({ email }) })
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-8 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Logo />

        <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
          {!sent ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>

              <h1 className="text-xl font-extrabold text-white mb-1">Forgot your password?</h1>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                No problem. Enter the email address linked to your Ridvest account and we'll send you a reset link.
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Email address</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading || !email}
                  className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 ${
                    loading || !email
                      ? "bg-amber-400/40 text-[#0d2137] cursor-not-allowed"
                      : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
                  }`}
                >
                  {loading ? "Sending..." : "Send reset link →"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">Check your email</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                We sent a password reset link to <span className="text-white font-semibold">{email}</span>. It expires in 15 minutes.
              </p>
              <div className="bg-white/5 border border-white/8 rounded-xl p-4 text-left mb-6">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Didn't get it? Check your spam folder. If it's not there, wait a minute and try again.
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors"
              >
                Try a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Remember your password?{" "}
          <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
