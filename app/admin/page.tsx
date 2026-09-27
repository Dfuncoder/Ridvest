/**
 * ADMIN OVERVIEW — the business at a glance.
 *
 * Every figure is computed live from the same ledger tables the users see, so
 * "does everything tally?" is answerable from this one page: money in, the
 * platform's cut, what is owed to investors, what has gone out, and what still
 * needs a human.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateInterestRate } from "@/app/actions/admin";
import { platformFee, PLATFORM_FEE_LABEL } from "@/lib/economics";
import { fmtNaira } from "@/lib/format";

export const metadata = { title: "Overview · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const { profile } = await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Aggregates are computed in JS from full-row fetches — fine at this scale;
  // swap for SQL aggregates if these tables grow into the tens of thousands.
  const [
    { count: userCount },
    { data: investments },
    { data: payouts },
    { data: withdrawals },
    { data: pools },
    { data: deposits },
    { data: rateSetting },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("investments").select("amount, status"),
    admin.from("payouts").select("amount, status"),
    admin.from("withdrawals").select("amount, status"),
    admin.from("pools").select("status, amount_raised"),
    admin.from("deposits").select("status"),
    admin.from("app_settings").select("value").eq("key", "interest_rate_percent").single(),
  ]);

  const totalInvested = (investments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const refundPending = (investments ?? [])
    .filter((i) => i.status === "refund_pending")
    .reduce((s, i) => s + Number(i.amount), 0);

  const totalPromised = (payouts ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalPaidOut = (payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = totalPromised - totalPaidOut;

  const pendingWithdrawals = (withdrawals ?? []).filter((w) => w.status === "pending");
  const pendingWithdrawalTotal = pendingWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const awaitingDeposits = (deposits ?? []).filter((d) => d.status === "awaiting_confirmation").length;

  const poolCounts: Record<string, number> = { open: 0, active: 0, completed: 0, cancelled: 0 };
  for (const p of pools ?? []) poolCounts[p.status] = (poolCounts[p.status] ?? 0) + 1;

  // The platform's cut is earned only once a pool is funded and running.
  const fundedRaised = (pools ?? [])
    .filter((p) => p.status === "active" || p.status === "completed")
    .reduce((s, p) => s + Number(p.amount_raised), 0);
  const earnedFee = platformFee(fundedRaised);

  // Still filling: what the fee becomes if these pools reach target.
  const fillingRaised = (pools ?? [])
    .filter((p) => p.status === "open")
    .reduce((s, p) => s + Number(p.amount_raised), 0);
  const pipelineFee = platformFee(fillingRaised);

  // What the vehicles must generate to cover investor returns on top of the fee.
  const assetBurden = totalPromised - (fundedRaised - earnedFee);

  const ledger = [
    { label: "Money in", value: fmtNaira(totalInvested), hint: "Confirmed investments" },
    { label: "Promised to investors", value: fmtNaira(totalPromised), hint: "Full payout schedule" },
    { label: "Paid out so far", value: fmtNaira(totalPaidOut), hint: "Payouts marked paid" },
    {
      label: "Still owed",
      value: fmtNaira(outstanding),
      hint: "Scheduled but not yet paid",
      tone: "text-slate-900",
    },
  ];

  const needsYou = [
    {
      label: "Transfers to confirm",
      value: String(awaitingDeposits),
      detail: awaitingDeposits === 1 ? "1 waiting" : `${awaitingDeposits} waiting`,
      href: "/admin/deposits",
      tone: awaitingDeposits > 0 ? "text-amber-500" : "text-slate-300",
    },
    {
      label: "Pending withdrawals",
      value: fmtNaira(pendingWithdrawalTotal),
      detail: `${pendingWithdrawals.length} request${pendingWithdrawals.length === 1 ? "" : "s"}`,
      href: "/admin/withdrawals",
      tone: pendingWithdrawals.length > 0 ? "text-amber-500" : "text-slate-300",
    },
    {
      label: "Refunds pending",
      value: fmtNaira(refundPending),
      detail: "Paid after a pool filled",
      href: "/admin/investments",
      tone: refundPending > 0 ? "text-red-500" : "text-slate-300",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Business overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back, {profile.full_name?.split(" ")[0] ?? "admin"} — live totals from the ledger.
        </p>
      </div>

      {/* ── PLATFORM EARNINGS ── */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0d2137] via-[#122c4b] to-[#193f68] p-6 sm:p-8 shadow-xl shadow-[#0d2137]/25">
        <div
          className="hidden md:block absolute -top-24 -right-20 w-96 h-96 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(250,204,21,0.16) 0%, transparent 68%)" }}
        />
        <div className="relative z-10">
          <p className={`${eyebrow} text-white/40 mb-2`}>
            Rydvest earnings · {PLATFORM_FEE_LABEL} of funded pools
          </p>
          <p className="text-[2.5rem] sm:text-5xl leading-[0.95] font-extrabold text-white tracking-[-0.03em] tabular-nums">
            {fmtNaira(earnedFee)}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-7">
            {[
              { label: "Funded pools", value: fmtNaira(fundedRaised) },
              { label: "In the pipeline", value: fmtNaira(pipelineFee), hint: "If filling pools close" },
              { label: "Registered users", value: String(userCount ?? 0) },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.07] border border-white/10 rounded-xl px-3.5 py-3">
                <p className={`${eyebrow} text-white/35 mb-1 leading-tight`}>{s.label}</p>
                <p className="text-sm font-extrabold text-white tabular-nums">{s.value}</p>
                {s.hint && <p className="text-[10px] text-white/30 mt-0.5">{s.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEEDS YOU ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">Needs you</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {needsYou.map((n) => (
            <Link key={n.label} href={n.href} className="group">
              <Card className="p-5 h-full transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-slate-300">
                <p className={`${eyebrow} text-slate-400 mb-2`}>{n.label}</p>
                <p className={`text-xl font-extrabold tabular-nums tracking-tight ${n.tone}`}>
                  {n.value}
                </p>
                <p className="text-[11px] text-slate-400 mt-1.5">{n.detail} →</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── LEDGER ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">The ledger</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ledger.map((s) => (
            <Card key={s.label} className="p-5">
              <p className={`${eyebrow} text-slate-400 mb-2 leading-tight`}>{s.label}</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums tracking-tight">
                {s.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">{s.hint}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5 mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className={`${eyebrow} text-slate-400 mb-2`}>What the vehicles must generate</p>
              <p
                className={`text-xl font-extrabold tabular-nums tracking-tight ${
                  assetBurden > 0 ? "text-slate-900" : "text-green-600"
                }`}
              >
                {fmtNaira(Math.max(0, assetBurden))}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm">
              Everything promised to investors, less the capital left after Rydvest&apos;s{" "}
              {PLATFORM_FEE_LABEL}. This is what pool earnings have to cover over the life of the
              pools.
            </p>
          </div>
        </Card>
      </section>

      {/* ── POOLS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Pools</h2>
          <Link
            href="/admin/pools"
            className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              ["open", "Filling", "text-blue-500"],
              ["active", "Active", "text-green-600"],
              ["completed", "Completed", "text-slate-900"],
              ["cancelled", "Cancelled", "text-red-500"],
            ] as const
          ).map(([key, label, tone]) => (
            <Card key={key} className="px-4 py-5 text-center">
              <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${tone}`}>
                {poolCounts[key] ?? 0}
              </p>
              <p className={`${eyebrow} text-slate-400 mt-1`}>{label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── HEADLINE RATE ── */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Public headline rate</h2>
        <p className="text-xs text-slate-400 mb-4">
          The percentage shown on the landing page.
        </p>
        <form action={updateInterestRate} className="flex gap-2 max-w-xs">
          <div className="relative flex-1">
            <input
              type="number"
              name="percent"
              min={0}
              max={1000}
              step="0.1"
              defaultValue={rateSetting?.value ?? "50"}
              className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 tabular-nums outline-none focus:border-amber-400 transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              %
            </span>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20"
          >
            Save
          </button>
        </form>
      </Card>
    </div>
  );
}
