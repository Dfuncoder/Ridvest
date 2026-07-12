"use client";

/**
 * USER DASHBOARD SHELL — client component: sidebar, topbar, mobile nav and
 * the light/dark theme context. Receives the real logged-in user's name and
 * email from the server layout (app/dashboard/layout.tsx); contains no data
 * fetching of its own.
 */
import { useState, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

// ── Theme context ──────────────────────────────────────────
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

// ── Logo ───────────────────────────────────────────────────
const Logo = () => (
  <Link href="/" className="flex items-center gap-2.5">
    <svg width="32" height="32" viewBox="0 0 36 36">
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
    <span className="text-lg font-extrabold text-white tracking-tight">
      Ryd<span className="text-amber-400">vest</span>
    </span>
  </Link>
);

// ── Nav items ──────────────────────────────────────────────
const navItems = [
  {
    label: "Overview", href: "/dashboard", exact: true,
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  },
  {
    label: "Invest", href: "/dashboard/invest",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  },
  {
    label: "Pools", href: "/dashboard/pools",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
  },
  {
    label: "Portfolio", href: "/dashboard/portfolio",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>,
  },
  {
    label: "Payouts", href: "/dashboard/payouts",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg>,
  },
  {
    label: "Profile", href: "/dashboard/profile",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  },
];

// ── Theme toggle button ────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}

// ── Nav link ───────────────────────────────────────────────
function NavLink({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
    </Link>
  );
}

// ── Sidebar content (shared between desktop + mobile) ─────
function SidebarContent({ name, email, onClose }: { name: string; email: string; onClose?: () => void }) {
  const initial = (name || email || "R").charAt(0).toUpperCase();
  return (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Main</p>
        {navItems.slice(0, 5).map((item) => <NavLink key={item.href} item={item} onClick={onClose} />)}
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2 mt-5">Account</p>
        {navItems.slice(5).map((item) => <NavLink key={item.href} item={item} onClick={onClose} />)}
      </nav>
      <div className="px-3 py-4 border-t border-white/8">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 mb-1">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-[#0d2137] font-extrabold text-sm shrink-0">{initial}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{email}</p>
          </div>
        </div>
        {/* Logout is a server action: clears the Supabase session cookies. */}
        <form action={logout}>
          <button type="submit" className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            Log out
          </button>
        </form>
      </div>
    </>
  );
}

// ── Mobile bottom nav link ─────────────────────────────────
function BottomNavLink({ item }: { item: typeof navItems[0] }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const { theme } = useTheme();
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors ${
        active ? "text-amber-500" : theme === "dark" ? "text-slate-500" : "text-slate-400"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

// ── Main shell ─────────────────────────────────────────────
export default function DashboardShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const isDark = theme === "dark";

  const pageBg = isDark ? "bg-[#060f1a]" : "bg-slate-100";
  const topbarBg = isDark ? "bg-[#0d2137]/95 border-white/8" : "bg-white/90 border-slate-200";
  const topbarText = isDark ? "text-white" : "text-slate-900";
  const topbarSub = isDark ? "text-slate-400" : "text-slate-400";
  const topbarBtn = isDark ? "hover:bg-white/8 text-slate-400" : "hover:bg-slate-100 text-slate-500";
  const bottomNavBg = isDark ? "bg-[#0d2137] border-white/8" : "bg-white border-slate-200";

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div className={`min-h-screen ${pageBg} flex transition-colors duration-300`}>

        {/* ── DESKTOP SIDEBAR (always dark) ── */}
        <aside className="hidden lg:flex flex-col w-64 bg-[#0d2137] shrink-0 fixed top-0 left-0 h-full z-30">
          <div className="px-5 h-16 flex items-center border-b border-white/8">
            <Logo />
          </div>
          <SidebarContent name={name} email={email} />
        </aside>

        {/* ── MOBILE SIDEBAR OVERLAY ── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative flex flex-col w-72 bg-[#0d2137] h-full z-50">
              <div className="px-5 h-16 flex items-center justify-between border-b border-white/8">
                <Logo />
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <SidebarContent name={name} email={email} onClose={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

          {/* Topbar */}
          <header className={`sticky top-0 z-20 backdrop-blur-md border-b px-5 lg:px-8 h-16 flex items-center justify-between gap-4 transition-colors duration-300 ${topbarBg}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className={`lg:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${topbarBtn}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              </button>
              <div>
                <p className={`text-xs leading-none mb-0.5 ${topbarSub}`}>Welcome back 👋</p>
                <p className={`text-sm font-bold leading-none ${topbarText}`}>{name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Link href="/dashboard/profile" className="w-9 h-9 rounded-full bg-[#0d2137] flex items-center justify-center text-amber-400 font-extrabold text-sm">
                {(name || email || "R").charAt(0).toUpperCase()}
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-5 lg:px-8 py-6 pb-24 lg:pb-6">
            {children}
          </main>

        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t grid grid-cols-5 transition-colors duration-300 ${bottomNavBg}`}>
          {navItems.slice(0, 5).map((item) => (
            <BottomNavLink key={item.href} item={item} />
          ))}
        </nav>

      </div>
    </ThemeCtx.Provider>
  );
}
