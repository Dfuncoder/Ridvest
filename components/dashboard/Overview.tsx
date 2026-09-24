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
  firstName: string;
  userCode: string;
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

/** Shared type styles, so hierarchy stays consistent across every block. */
const eyebrow = "text-[10px] font-bold uppercase tracking-[0.16em]";
const sectionTitle = "text-base font-extrabold tracking-tight";

const ICONS = {
  deposit: "M12 4.5v15m0 0l6-6m-6 6l-6-6M3 21h18",
  invest: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  pools:
    "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  payouts:
    "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
};

function Icon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/**
 * The account code, with a copy button. This is what another Rydvest user will
 * send money to, so it reads in a mono face where the characters can't be
 * confused for one another.
 */
function AccountCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] border border-white/10 pl-4 pr-1.5 py-1.5">
      <div className="min-w-0">
        <p className={`${eyebrow} text-white/35 mb-0.5`}>Account ID</p>
        <p className="font-mono text-sm font-bold text-white tracking-wider truncate">{code}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Account ID copied" : "Copy account ID"}
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function Overview({ data }: { data: OverviewData }) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const card = isDark
    ? "bg-[#0d2137] border border-white/8"
    : "bg-white border border-slate-200/80 shadow-sm shadow-slate-200/40";
  const cardMuted = isDark ? "bg-white/5 border border-white/8" : "bg-slate-50/80 border border-slate-100";
  const heading = isDark ? "text-white" : "text-slate-900";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const faint = isDark ? "text-slate-500" : "text-slate-400";
  const divider = isDark ? "divide-white/8" : "divide-slate-100";
  const quickBtn = isDark
    ? "bg-[#0f2e52] border-white/8 text-slate-300 hover:bg-white/10"
    : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/50";

  const stats = [
    { label: "Total invested", value: fmtNaira(data.totalInvested), tone: heading },
    { label: "Total earned", value: fmtNaira(data.totalEarned), tone: "text-green-500" },
    {
      label: "Next payout",
      value: data.nextPayout ? fmtNaira(data.nextPayout.amount) : "—",
      tone: "text-amber-500",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 sm:gap-7">

      {/* ── BALANCE ── */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0d2137] via-[#122c4b] to-[#193f68] p-6 sm:p-8 shadow-xl shadow-[#0d2137]/25">
        {/* Radial gradients rather than filter:blur — mobile GPUs glitch on
            extra composited layers. */}
        <div
          className="hidden md:block absolute -top-24 -right-20 w-96 h-96 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(250,204,21,0.16) 0%, transparent 68%)" }}
        />
        <div
          className="hidden md:block absolute -bottom-28 -left-20 w-80 h-80 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 68%)" }}
        />

        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
            <div className="min-w-0">
              <p className={`${eyebrow} text-white/40 mb-2`}>
                {data.firstName ? `${data.firstName}'s balance` : "Available balance"}
              </p>
              <div className="flex items-center gap-3">
                <h1 className="text-[2.5rem] sm:text-5xl leading-[0.95] font-extrabold text-white tracking-[-0.03em] tabular-nums">
                  {balanceVisible ? fmtNaira(data.balance) : "₦ ••••••"}
                </h1>
                <button
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="text-white/35 hover:text-white/80 transition-colors shrink-0 mt-1"
                  aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {balanceVisible ? (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </>
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <AccountCode code={data.userCode} />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/dashboard/deposit"
              className="flex-1 sm:flex-none text-center px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-2xl transition-all duration-150 shadow-lg shadow-amber-400/25"
            >
              Deposit
            </Link>
            <Link
              href="/dashboard/invest"
              className="flex-1 sm:flex-none text-center px-6 py-3.5 bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 text-white font-extrabold text-sm rounded-2xl transition-all duration-150"
            >
              Invest
            </Link>
          </div>

          {data.nextPayout && (
            <div className="mt-6 flex items-center gap-2 pt-5 border-t border-white/10">
              <Icon d={ICONS.payouts} className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-white/50">
                Next payout on{" "}
                <span className="text-white font-semibold">{fmtDate(data.nextPayout.date)}</span>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl px-4 py-4 sm:px-5 sm:py-5 ${card}`}>
            <p className={`${eyebrow} ${faint} mb-2 leading-tight`}>{s.label}</p>
            <p className={`text-base sm:text-xl font-extrabold tabular-nums tracking-tight ${s.tone}`}>
              {s.value}
            </p>
          </div>
        ))}
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: "Deposit", href: "/dashboard/deposit", d: ICONS.deposit },
          { label: "Invest", href: "/dashboard/invest", d: ICONS.invest },
          { label: "Pools", href: "/dashboard/pools", d: ICONS.pools },
          { label: "Withdraw", href: "/dashboard/payouts", d: ICONS.payouts },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={`flex flex-col items-center justify-center gap-2 py-4 sm:py-5 rounded-2xl font-bold text-[11px] sm:text-xs border transition-all duration-150 hover:-translate-y-0.5 ${quickBtn}`}
          >
            <Icon d={a.d} />
            {a.label}
          </Link>
        ))}
      </section>

      {/* ── INVESTMENTS ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${sectionTitle} ${heading}`}>My investments</h2>
          <Link
            href="/dashboard/portfolio"
            className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            View all →
          </Link>
        </div>

        {data.investments.length === 0 ? (
          <div className={`rounded-2xl p-10 text-center ${card}`}>
            <p className={`text-sm ${muted} mb-5`}>You haven&apos;t invested yet.</p>
            <Link
              href="/dashboard/invest"
              className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-400/20"
            >
              Make your first investment →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4">
            {data.investments.map((inv) => {
              const badge = STATUS_BADGE[inv.poolStatus] ?? STATUS_BADGE.open;
              const isFilling = inv.poolStatus === "open";
              const pct = isFilling
                ? inv.fillPct
                : Math.round((inv.weeksDone / Math.max(1, inv.weeksTotal)) * 100);
              return (
                <Link
                  key={inv.id}
                  href={`/dashboard/pools/${inv.poolId}`}
                  className={`rounded-2xl p-5 sm:p-6 block transition-all duration-150 hover:-translate-y-0.5 ${card}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-extrabold tracking-tight ${heading}`}>
                          {inv.poolName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className={`text-xs ${muted}`}>
                        {inv.startedAt ? `Started ${fmtDate(inv.startedAt)}` : "Waiting for the pool to fill"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-extrabold tabular-nums tracking-tight ${heading}`}>
                        {fmtNaira(inv.amount)}
                      </p>
                      <p className={`text-[11px] ${faint}`}>invested</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 mb-5">
                    <div className={`rounded-xl px-3 py-2.5 ${cardMuted}`}>
                      <p className={`${eyebrow} ${faint} mb-1 leading-tight`}>Earned</p>
                      <p className="text-sm font-extrabold tabular-nums text-green-500">
                        {fmtNaira(inv.earned)}
                      </p>
                    </div>
                    <div className={`rounded-xl px-3 py-2.5 ${cardMuted}`}>
                      <p className={`${eyebrow} ${faint} mb-1 leading-tight`}>Expected</p>
                      <p className={`text-sm font-extrabold tabular-nums ${heading}`}>
                        {fmtNaira(inv.totalExpected)}
                      </p>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 bg-amber-500/10 border border-amber-500/20">
                      <p className={`${eyebrow} text-amber-500/70 mb-1 leading-tight`}>Next</p>
                      <p className="text-sm font-extrabold tabular-nums text-amber-500">
                        {inv.nextPayoutDate ? fmtDate(inv.nextPayoutDate) : "—"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className={`flex justify-between text-xs mb-2 ${muted}`}>
                      <span>
                        {isFilling ? `Pool ${pct}% filled` : `Week ${inv.weeksDone} of ${inv.weeksTotal}`}
                      </span>
                      <span className={`font-bold ${heading}`}>{pct}%</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-300 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {inv.endsAt && <p className={`text-xs mt-2.5 ${faint}`}>Ends {fmtDate(inv.endsAt)}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── RECENT PAYOUTS ── */}
      <section className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${sectionTitle} ${heading}`}>Recent payouts</h2>
          <Link
            href="/dashboard/payouts"
            className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            View all →
          </Link>
        </div>

        {data.recentPayouts.length === 0 ? (
          <div className={`rounded-2xl p-8 text-center ${card}`}>
            <p className={`text-sm ${muted}`}>
              No payouts yet — they&apos;ll appear here once your pool starts running.
            </p>
          </div>
        ) : (
          <div className={`rounded-2xl overflow-hidden divide-y ${card} ${divider}`}>
            {data.recentPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5l7.5 7.5 7.5-7.5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-extrabold tabular-nums tracking-tight ${heading}`}>
                      {fmtNaira(p.amount)}
                    </p>
                    <p className={`text-xs ${faint} truncate`}>{fmtDate(p.date)}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 shrink-0">
                  Paid
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
