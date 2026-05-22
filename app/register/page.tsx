"use client";

import Link from "next/link";
import { useState } from "react";

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

// Shared input styles
const inputClass = "w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors";
const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5";

function FieldIcon({ path }: { path: string | string[] }) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
    </svg>
  );
}

const icons = {
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  mail: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  lock: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  id: ["M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"],
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5",
  pin: ["M15 10.5a3 3 0 11-6 0 3 3 0 016 0z", "M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"],
  bank: "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z",
  card: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
};

const steps = ["Personal details", "Identity verification", "Bank details"];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-8 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Logo />

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

        {/* STEP 1 — Personal details */}
        {step === 1 && (
          <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
            <h1 className="text-xl font-extrabold text-white mb-1">Create your account</h1>
            <p className="text-sm text-slate-400 mb-6">Start investing in minutes</p>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First name</label>
                  <div className="relative">
                    <FieldIcon path={icons.user} />
                    <input type="text" placeholder="Jude" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Last name</label>
                  <div className="relative">
                    <FieldIcon path={icons.user} />
                    <input type="text" placeholder="Mbakwe" className={inputClass} />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Email address</label>
                <div className="relative">
                  <FieldIcon path={icons.mail} />
                  <input type="email" placeholder="you@example.com" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Phone number</label>
                <div className="relative">
                  <FieldIcon path={icons.phone} />
                  <input type="tel" placeholder="+234 800 000 0000" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <FieldIcon path={icons.lock} />
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      {showPwd
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      }
                    </svg>
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <button onClick={() => setStep(2)} className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mt-1">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Identity verification */}
        {step === 2 && (
          <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
            <h1 className="text-xl font-extrabold text-white mb-1">Verify your identity</h1>
            <p className="text-sm text-slate-400 mb-5">Required by Nigerian financial regulations</p>

            <div className="bg-white/5 border border-white/8 rounded-xl p-4 flex gap-3 mb-5">
              <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">Your data is encrypted and stored securely. We never share your personal details with third parties.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>BVN</label>
                <div className="relative">
                  <FieldIcon path={icons.id} />
                  <input type="text" placeholder="Bank Verification Number" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>NIN <span className="normal-case font-normal text-slate-600">(optional)</span></label>
                <div className="relative">
                  <FieldIcon path={icons.id} />
                  <input type="text" placeholder="National Identification Number" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Date of birth</label>
                <div className="relative">
                  <FieldIcon path={icons.calendar} />
                  <input type="date" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>State of residence</label>
                <div className="relative">
                  <FieldIcon path={icons.pin} />
                  <input type="text" placeholder="e.g. Anambra" className={inputClass} />
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                <button onClick={() => setStep(1)} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
                  ← Back
                </button>
                <button onClick={() => setStep(3)} className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150">
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Bank details */}
        {step === 3 && (
          <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">
            <h1 className="text-xl font-extrabold text-white mb-1">Bank details</h1>
            <p className="text-sm text-slate-400 mb-6">Where your returns will be paid every month</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Bank name</label>
                <div className="relative">
                  <FieldIcon path={icons.bank} />
                  <input type="text" placeholder="e.g. First Bank of Nigeria" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Account number</label>
                <div className="relative">
                  <FieldIcon path={icons.card} />
                  <input type="text" placeholder="10-digit account number" maxLength={10} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Account name</label>
                <div className="relative">
                  <FieldIcon path={icons.user} />
                  <input
                    type="text"
                    placeholder="Auto-filled after verification"
                    readOnly
                    className="w-full pl-9 pr-4 py-3 bg-white/3 border border-white/5 rounded-xl text-sm text-slate-600 placeholder:text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-amber-400"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  I agree to Ridvest's{" "}
                  <Link href="/terms" className="text-amber-400 hover:text-amber-300 transition-colors">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-amber-400 hover:text-amber-300 transition-colors">Privacy Policy</Link>.
                  I confirm that all details provided are accurate.
                </span>
              </label>

              <div className="flex gap-3 mt-1">
                <button onClick={() => setStep(2)} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
                  ← Back
                </button>
                <button
                  disabled={!agreed}
                  className={`flex-1 py-3 font-extrabold text-sm rounded-xl transition-all duration-150 ${
                    agreed
                      ? "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] shadow-lg shadow-amber-400/20"
                      : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5"
                  }`}
                >
                  Create account →
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
            Login
          </Link>
        </p>

      </div>
    </main>
  );
}
