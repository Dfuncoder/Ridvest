"use client";

/**
 * ADMIN DASHBOARD SHELL — sidebar navigation for the admin area.
 * The auth/role gate lives in app/admin/layout.tsx (server); this is UI only.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const navItems = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Pool options", href: "/admin/products" },
  { label: "Pools", href: "/admin/pools" },
  { label: "Investments", href: "/admin/investments" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Withdrawals", href: "/admin/withdrawals" },
  { label: "Users", href: "/admin/users" },
];

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
      {item.label}
    </Link>
  );
}

function SidebarContent({ name, onClose }: { name: string; onClose?: () => void }) {
  return (
    <>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Admin</p>
        {navItems.map((item) => <NavLink key={item.href} item={item} onClick={onClose} />)}
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2 mt-5">Switch</p>
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition-all">
          → User dashboard
        </Link>
      </nav>
      <div className="px-3 py-4 border-t border-white/8">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-xs text-amber-400">Administrator</p>
        </div>
        <form action={logout}>
          <button type="submit" className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
            Log out
          </button>
        </form>
      </div>
    </>
  );
}

export default function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0d2137] shrink-0 fixed top-0 left-0 h-full z-30">
        <div className="px-5 h-16 flex items-center border-b border-white/8">
          <Link href="/admin" className="text-lg font-extrabold text-white tracking-tight">
            Ryd<span className="text-amber-400">vest</span>
            <span className="ml-2 text-[10px] font-bold text-[#0d2137] bg-amber-400 px-1.5 py-0.5 rounded uppercase align-middle">Admin</span>
          </Link>
        </div>
        <SidebarContent name={name} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-[#0d2137] h-full z-50">
            <div className="px-5 h-16 flex items-center justify-between border-b border-white/8">
              <span className="text-lg font-extrabold text-white">
                Ryd<span className="text-amber-400">vest</span>{" "}
                <span className="text-[10px] font-bold text-[#0d2137] bg-amber-400 px-1.5 py-0.5 rounded uppercase">Admin</span>
              </span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors" aria-label="Close menu">✕</button>
            </div>
            <SidebarContent name={name} onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 lg:px-8 h-16 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <p className="text-sm font-bold text-slate-900">Admin console</p>
        </header>
        <main className="flex-1 px-5 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
