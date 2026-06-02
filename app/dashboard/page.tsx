"use client";

import Link from "next/link";
import { useState } from "react";

function fmt(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

function ProgressBar({ pct, color = "bg-amber-400" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Dummy data — replace with API calls ──
const user = { name: "Jude", initial: "J" };

const balance = {
  wallet: 450_000,
  totalInvested: 1_200_000,
  totalEarned: 87_500,
  nextPayout: 16_667,
  nextPayoutDate: "Jun 1, 2026",
};

const investments = [
  {
    id: "INV-001",
    name: "Keke Napep — Growth",
    amount: 200_000,
    amountPaid: 87_500,
    amountRemaining: 112_500,
    weeklyReturn: 962,
    startDate: "Nov 18, 2025",
    endDate: "May 2, 2027",
    weeksTotal: 78,
    weeksDone: 28,
    nextPayoutDate: "Jun 1, 2026",
    status: "active",
  },
  {
    id: "INV-002",
    name: "Keke Napep — Starter",
    amount: 100_000,
    amountPaid: 19_231,
    amountRemaining: 80_769,
    weeklyReturn: 481,
    startDate: "Jan 6, 2026",
    endDate: "Jun 22, 2027",
    weeksTotal: 78,
    weeksDone: 20,
    nextPayoutDate: "Jun 1, 2026",
    status: "active",
  },
];

const recentPayouts = [
  { id: "P001", date: "May 18, 2026", amount: 1_443, investment: "INV-001 & INV-002", status: "paid" },
  { id: "P002", date: "May 11, 2026", amount: 1_443, investment: "INV-001 & INV-002", status: "paid" },
  { id: "P003", date: "May 4, 2026", amount: 1_443, investment: "INV-001 & INV-002", status: "paid" },
];

export default function DashboardPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">

      {/* ── BALANCE HERO CARD ── */}
      <div className="bg-[#0d2137] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-10 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400 rounded-full blur-[80px] opacity-8 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Wallet balance</p>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {balanceVisible ? fmt(balance.wallet) : "₦ ••••••"}
                </h1>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {balanceVisible
                      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    }
                  </svg>
                </button>
              </div>
            </div>
            <Link href="/dashboard/invest" className="bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shrink-0">
              + Invest
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total invested", value: fmt(balance.totalInvested), color: "text-white" },
              { label: "Total earned", value: fmt(balance.totalEarned), color: "text-green-400" },
              { label: "Next payout", value: fmt(balance.nextPayout), color: "text-amber-400" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{s.label}</p>
                <p className={`text-sm font-extrabold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
            </svg>
            <p className="text-xs text-slate-400">Next payout on <span className="text-white font-semibold">{balance.nextPayoutDate}</span></p>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Invest", href: "/dashboard/invest", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>, color: "bg-amber-400 text-[#0d2137]" },
          { label: "Portfolio", href: "/dashboard/portfolio", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>, color: "bg-white text-slate-700" },
          { label: "Pools", href: "/dashboard/pools", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>, color: "bg-white text-slate-700" },
          { label: "Payouts", href: "/dashboard/payouts", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg>, color: "bg-white text-slate-700" },
        ].map((a) => (
          <Link key={a.label} href={a.href} className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl font-semibold text-xs border border-slate-200 transition-all hover:shadow-md hover:-translate-y-0.5 ${a.color}`}>
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── INVESTMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-slate-900">My investments</h2>
          <Link href="/dashboard/portfolio" className="text-xs text-amber-500 font-semibold hover:text-amber-400">View all →</Link>
        </div>

        <div className="flex flex-col gap-4">
          {investments.map((inv) => {
            const pct = Math.round((inv.weeksDone / inv.weeksTotal) * 100);
            const weeksLeft = inv.weeksTotal - inv.weeksDone;
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-extrabold text-slate-900">{inv.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Active</span>
                    </div>
                    <p className="text-xs text-slate-500">{inv.id} · Started {inv.startDate}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-slate-900">{fmt(inv.amount)}</p>
                    <p className="text-xs text-slate-400">invested</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Earned so far</p>
                    <p className="text-sm font-extrabold text-green-600">{fmt(inv.amountPaid)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Remaining</p>
                    <p className="text-sm font-extrabold text-slate-900">{fmt(inv.amountRemaining)}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] text-amber-700 uppercase tracking-wider mb-1">Weekly return</p>
                    <p className="text-sm font-extrabold text-amber-600">{fmt(inv.weeklyReturn)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Week {inv.weeksDone} of {inv.weeksTotal}</span>
                    <span className="font-semibold text-slate-700">{pct}% complete</span>
                  </div>
                  <ProgressBar pct={pct} />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" /></svg>
                    Next payout <span className="text-slate-700 font-semibold">{inv.nextPayoutDate}</span>
                  </div>
                  <span className="text-xs text-slate-500">{weeksLeft} weeks left · ends {inv.endDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RECENT PAYOUTS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-slate-900">Recent payouts</h2>
          <Link href="/dashboard/payouts" className="text-xs text-amber-500 font-semibold hover:text-amber-400">View all →</Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {recentPayouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5l7.5 7.5 7.5-7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{fmt(p.amount)}</p>
                  <p className="text-xs text-slate-500">{p.investment} · {p.date}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-100">Paid</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}