"use client";

/**
 * DASHBOARD OVERVIEW VIEW — client component (needs the theme context).
 * Receives all numbers pre-computed from the server page; renders only.
 */
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "./Shell";
import { fmtNaira, fmtDate } from "@/lib/format";

export type OverviewData = {
  balance: number;
  totalInvested: number;
  totalEarned: number;
  nextPayout: { amount: number; date: string } | null;
  investments: Array<{
    id: string;
    poolId: string;
    poolName: string;
    poolStatus: string; // open | active | completed | cancelled
    amount: number;
    earned: number;
    totalExpected: number;
    weeksTotal: number;
    weeksDone: number;
    fillPct: number;
    startedAt: string | null;
    endsAt: string | null;
    nextPayoutDate: string | null;
  }>;
  recentPayouts: Array<{ id: string; date: string; amount: number }>;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: "Filling", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  active: { label: "Active", cls: "bg-green-500/10 text-green-500 border-green-500/20" },
  completed: { label: "Completed", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function Overview({ data }: { data: OverviewData }) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const card = isDark ? "bg-[#0d2137] border border-white/8" : "bg-white border border-slate-200";
  const cardMuted = isDark ? "bg-white/5 border border-white/8" : "bg-slate-50 border border-slate-100";
  const h2 = isDark ? "text-white" : "text-slate-900";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const divider = isDark ? "divide-white/8" : "divide-slate-100";
  const quickBtn = isDark ? "bg-[#0f2e52] border-white/8 text-slate-300 hover:bg-white/8" : "bg-white border-slate-200 text-slate-700 hover:shadow-md";

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 sm:gap-6">

      {/* ── BALANCE HERO CARD ── */}
      <div className="bg-[#0d2137] rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        {/* Radial gradients instead of filter:blur — avoids mobile GPU artifacts.
            Hidden on phones: old WebViews glitch on extra composited layers. */}
        <div className="hidden md:block absolute top-0 right-0 w-96 h-96 translate-x-1/3 -translate-y-1/3 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />
        <div className="hidden md:block absolute bottom-0 left-0 w-72 h-72 -translate-x-1/3 translate-y-1/3 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 65%)" }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest mb-1.5">Available balance</p>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight tabular-nums">
                  {balanceVisible ? fmtNaira(data.balance) : "₦ ••••••"}
                </h1>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0" aria-label="Toggle balance visibility">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {balanceVisible
                      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    }
                  </svg>
                </button>
              </div>
            </div>
            <Link href="/dashboard/invest" className="bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-[11px] sm:text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shrink-0 shadow-lg shadow-amber-400/20 whitespace-nowrap">
              + Invest
            </Link>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Total invested", value: fmtNaira(data.totalInvested), color: "text-white" },
              { label: "Total earned", value: fmtNaira(data.totalEarned), color: "text-green-400" },
              { label: "Next payout", value: data.nextPayout ? fmtNaira(data.nextPayout.amount) : "—", color: "text-amber-400" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 sm:p-3 flex items-center justify-between sm:block"
              >
                <p className="text-[11px] sm:text-[10px] text-slate-500 sm:mb-1 uppercase tracking-wider">{s.label}</p>
                <p className={`text-base sm:text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {data.nextPayout && (
            <div className="mt-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" /></svg>
              <p className="text-[11px] sm:text-xs text-slate-400">Next payout on <span className="text-white font-semibold">{fmtDate(data.nextPayout.date)}</span></p>
            </div>
          )}
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Invest", href: "/dashboard/invest", primary: true, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> },
          { label: "Pools", href: "/dashboard/pools", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg> },
          { label: "Portfolio", href: "/dashboard/portfolio", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg> },
          { label: "Payouts", href: "/dashboard/payouts", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg> },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-4 rounded-xl font-semibold text-[10px] sm:text-xs border transition-all hover:-translate-y-0.5 ${
              a.primary
                ? "bg-amber-400 text-[#0d2137] border-transparent hover:bg-amber-300 shadow-lg shadow-amber-400/20"
                : quickBtn
            }`}
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── INVESTMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm sm:text-base font-extrabold ${h2}`}>My investments</h2>
          <Link href="/dashboard/portfolio" className="text-xs text-amber-500 font-semibold hover:text-amber-400">View all →</Link>
        </div>

        {data.investments.length === 0 ? (
          <div className={`rounded-2xl p-8 text-center ${card}`}>
            <p className={`text-sm ${muted} mb-4`}>You haven't invested yet.</p>
            <Link href="/dashboard/invest" className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20">
              Make your first investment →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4">
            {data.investments.map((inv) => {
              const badge = STATUS_BADGE[inv.poolStatus] ?? STATUS_BADGE.open;
              const isFilling = inv.poolStatus === "open";
              // Filling pools show fill %, running pools show payout progress.
              const pct = isFilling
                ? inv.fillPct
                : Math.round((inv.weeksDone / Math.max(1, inv.weeksTotal)) * 100);
              return (
                <Link key={inv.id} href={`/dashboard/pools/${inv.poolId}`} className={`rounded-2xl p-4 sm:p-5 transition-colors duration-300 block hover:opacity-90 ${card}`}>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-extrabold ${h2}`}>{inv.poolName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <p className={`text-[11px] sm:text-xs ${muted}`}>
                        {inv.startedAt ? `Started ${fmtDate(inv.startedAt)}` : "Waiting for the pool to fill"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-extrabold tabular-nums ${h2}`}>{fmtNaira(inv.amount)}</p>
                      <p className={`text-[11px] sm:text-xs ${muted}`}>invested</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                    <div className={`rounded-xl px-3.5 py-2.5 sm:p-3 flex items-center justify-between sm:block ${cardMuted}`}>
                      <p className={`text-[11px] sm:text-[10px] uppercase tracking-wider sm:mb-1 ${muted}`}>Earned so far</p>
                      <p className="text-sm font-extrabold tabular-nums text-green-500">{fmtNaira(inv.earned)}</p>
                    </div>
                    <div className={`rounded-xl px-3.5 py-2.5 sm:p-3 flex items-center justify-between sm:block ${cardMuted}`}>
                      <p className={`text-[11px] sm:text-[10px] uppercase tracking-wider sm:mb-1 ${muted}`}>Total expected</p>
                      <p className={`text-sm font-extrabold tabular-nums ${h2}`}>{fmtNaira(inv.totalExpected)}</p>
                    </div>
                    <div className="rounded-xl px-3.5 py-2.5 sm:p-3 flex items-center justify-between sm:block bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[11px] sm:text-[10px] text-amber-500 uppercase tracking-wider sm:mb-1">Next payout</p>
                      <p className="text-sm font-extrabold tabular-nums text-amber-500">{inv.nextPayoutDate ? fmtDate(inv.nextPayoutDate) : "—"}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className={`flex justify-between text-[11px] sm:text-xs mb-1.5 ${muted}`}>
                      <span>
                        {isFilling
                          ? `Pool ${pct}% filled`
                          : `Week ${inv.weeksDone} of ${inv.weeksTotal}`}
                      </span>
                      <span className={`font-semibold ${h2}`}>{pct}%</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
                      <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    {inv.endsAt && (
                      <p className={`text-[11px] sm:text-xs mt-2 ${muted}`}>Ends {fmtDate(inv.endsAt)}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RECENT PAYOUTS ── */}
      <div className="pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm sm:text-base font-extrabold ${h2}`}>Recent payouts</h2>
          <Link href="/dashboard/payouts" className="text-xs text-amber-500 font-semibold hover:text-amber-400">View all →</Link>
        </div>

        {data.recentPayouts.length === 0 ? (
          <div className={`rounded-2xl p-6 text-center ${card}`}>
            <p className={`text-sm ${muted}`}>No payouts yet — they'll appear here once your pool starts running.</p>
          </div>
        ) : (
          <div className={`rounded-2xl overflow-hidden divide-y transition-colors duration-300 ${card} ${divider}`}>
            {data.recentPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5l7.5 7.5 7.5-7.5" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold tabular-nums ${h2}`}>{fmtNaira(p.amount)}</p>
                    <p className={`text-[11px] sm:text-xs ${muted} truncate`}>{fmtDate(p.date)}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 shrink-0">Paid</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
