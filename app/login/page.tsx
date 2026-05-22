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

export default function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-8 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <Logo />

        {/* Card */}
        <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7">

          <h1 className="text-xl font-extrabold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-6">Login to your Ridvest account</p>

          <div className="flex flex-col gap-4">

            {/* Email */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Email address</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {showPwd ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <div className="text-right mt-2">
                <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 mt-1">
              Login to Ridvest →
            </button>

          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Don't have an account?{" "}
          <Link href="/register" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
            Create one →
          </Link>
        </p>

      </div>
    </main>
  );
}
