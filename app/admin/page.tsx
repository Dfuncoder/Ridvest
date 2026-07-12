/**
 * ADMIN OVERVIEW — the business at a glance: money in, money promised,
 * money paid out, projected margin, and pending work (withdrawals/refunds).
 *
 * "Does everything tally?" — total invested vs. payout schedule vs. paid out
 * are all computed live from the same ledger tables the users see.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateInterestRate } from "@/app/actions/admin";
import { fmtNaira } from "@/lib/format";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Aggregates are computed in JS from full-row fetches — fine at this scale;
  // swap for SQL aggregates if these tables grow into the tens of thousands.
  const [
    { count: userCount },
    { data: investments },
    { data: payouts },
    { data: withdrawals },
    { data: pools },
    { data: rateSetting },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("investments").select("amount, status"),
    admin.from("payouts").select("amount, status"),
    admin.from("withdrawals").select("amount, status"),
    admin.from("pools").select("status"),
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

  const poolCounts = { open: 0, active: 0, completed: 0, cancelled: 0 } as Record<string, number>;
  for (const p of pools ?? []) poolCounts[p.status] = (poolCounts[p.status] ?? 0) + 1;

  // Projected margin: money collected minus everything promised back to
  // investors. Negative = the amount pool assets (keke earnings) must
  // generate for the business to break even.
  const projectedMargin = totalInvested - totalPromised;

  const stats = [
    { label: "Registered users", value: String(userCount ?? 0) },
    { label: "Total invested (paid)", value: fmtNaira(totalInvested) },
    { label: "Total promised to investors", value: fmtNaira(totalPromised) },
    { label: "Paid out so far", value: fmtNaira(totalPaidOut) },
    { label: "Outstanding payout liability", value: fmtNaira(outstanding) },
    {
      label: "Projected margin (invested − promised)",
      value: fmtNaira(projectedMargin),
      accent: projectedMargin >= 0 ? "text-green-600" : "text-red-500",
      hint: "Negative = revenue the assets must generate to cover investor returns.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Business overview</h1>
        <p className="text-sm text-slate-500">Live totals from the ledger — investments, payouts and withdrawals.</p>
      </div>

      {/* Key numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold tabular-nums ${s.accent ?? "text-slate-900"}`}>{s.value}</p>
            {s.hint && <p className="text-[11px] text-slate-400 mt-1.5">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* Needs attention */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/withdrawals" className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Pending withdrawals</p>
          <p className="text-xl font-extrabold text-amber-500 tabular-nums">
            {pendingWithdrawals.length} · {fmtNaira(pendingWithdrawalTotal)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">Review and pay →</p>
        </Link>
        <Link href="/admin/investments" className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Refunds pending</p>
          <p className="text-xl font-extrabold text-red-500 tabular-nums">{fmtNaira(refundPending)}</p>
          <p className="text-[11px] text-slate-400 mt-1.5">Payments that arrived after a pool filled →</p>
        </Link>
      </div>

      {/* Pools snapshot */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900">Pools</h2>
          <Link href="/admin/pools" className="text-xs text-amber-500 font-semibold">Manage →</Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["open", "active", "completed", "cancelled"] as const).map((st) => (
            <div key={st} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
              <p className="text-lg font-extrabold text-slate-900">{poolCounts[st] ?? 0}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider capitalize">{st === "open" ? "Filling" : st}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Headline interest rate */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Public headline rate</h2>
        <p className="text-xs text-slate-400 mb-3">Shown on the landing page (via /api/interest-rate).</p>
        <form action={updateInterestRate} className="flex gap-2 max-w-xs">
          <input
            type="number"
            name="percent"
            min={0}
            max={1000}
            step="0.1"
            defaultValue={rateSetting?.value ?? "50"}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-amber-400"
          />
          <button type="submit" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-sm rounded-xl transition-all">
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
