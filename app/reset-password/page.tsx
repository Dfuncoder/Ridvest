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

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{ background: i < score ? colors[score - 1] : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>
      <p className="text-xs mt-1.5" style={{ color: score > 0 ? colors[score - 1] : "#64748b" }}>
        {labels[Math.max(0, score - 1)]}
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && confirm === password;

  const handleReset = async () => {
    if (!canSubmit) return;
    setLoading(true);
    // Replace with your API call:
    // await fetch("/api/reset-password", { method: "POST", body: JSON.stringify({ password, token: searchParams.get("token") }) })
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {show
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
        }
      </svg>
    </button>
  );

  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-8 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Logo />

        <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
          {!done ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>

              <h1 className="text-xl font-extrabold text-white mb-1">Create new password</h1>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Choose a strong password for your Ridvest account.
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">New password</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                    />
                    <EyeToggle show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Confirm password</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`w-full pl-9 pr-10 py-3 bg-white/5 border rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-colors ${
                        mismatch ? "border-red-500" : "border-white/10 focus:border-amber-400"
                      }`}
                    />
                    <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                  </div>
                  {mismatch && (
                    <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  disabled={loading || !canSubmit}
                  className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 mt-1 ${
                    loading || !canSubmit
                      ? "bg-amber-400/40 text-[#0d2137] cursor-not-allowed"
                      : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] shadow-lg shadow-amber-400/20"
                  }`}
                >
                  {loading ? "Resetting..." : "Reset password →"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">Password reset!</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your password has been updated. Taking you to login...
              </p>
              <div className="flex justify-center gap-1 mt-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {!done && (
          <p className="text-center text-sm text-slate-500 mt-5">
            Remember your password?{" "}
            <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
              Back to login
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
