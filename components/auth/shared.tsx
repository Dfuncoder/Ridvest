"use client";

/**
 * Shared building blocks for the auth pages (login, register, verify-otp,
 * forgot/reset password) — logo, input styling, icons, banners.
 * Pure UI: no data fetching, no secrets.
 */
import Link from "next/link";

// ── Brand logo ──────────────────────────────────────────────────────────────
export function Logo() {
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
      </svg>
      <div className="text-center">
        <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
          Ryd<span className="text-amber-400">vest</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 tracking-widest uppercase">Invest. Ride. Earn.</p>
      </div>
    </Link>
  );
}

// ── Input styling shared across auth forms ──────────────────────────────────
export const inputClass =
  "w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors";
export const labelClass =
  "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5";

export function FieldIcon({ path }: { path: string | string[] }) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
    </svg>
  );
}

export const icons = {
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  mail: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  lock: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5",
  pin: ["M15 10.5a3 3 0 11-6 0 3 3 0 016 0z", "M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"],
  home: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
};

// ── Show/hide password toggle ───────────────────────────────────────────────
export function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label="Toggle password visibility">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {show
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
        }
      </svg>
    </button>
  );
}

// ── Password strength meter (UX only — server enforces the real rules) ─────
export function PasswordStrength({ password }: { password: string }) {
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

// ── Error / success banners ─────────────────────────────────────────────────
export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-xs text-red-400">{message}</p>
    </div>
  );
}

export function SuccessBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <p className="text-xs text-green-400">{message}</p>
    </div>
  );
}

/** Small red text under a field. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-400 mt-1.5">{message}</p>;
}

/** Full-page dark background used by every auth screen. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0d2137] flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Decorative glows as radial gradients — NOT filter:blur, which causes
          severe paint artifacts (ghosting/black bands) on low-end mobile GPUs.
          Hidden on phones entirely: old/unupdatable WebViews (e.g. devices
          without Google services) glitch on any extra composited layer, and
          the glow is barely visible on small screens anyway. */}
      <div className="hidden md:block absolute top-0 left-0 w-125 h-125 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />
      <div className="hidden md:block absolute bottom-0 right-0 w-110 h-110 translate-x-1/3 translate-y-1/3 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 65%)" }} />
      <div className="relative w-full max-w-sm">
        <Logo />
        {children}
      </div>
    </main>
  );
}
