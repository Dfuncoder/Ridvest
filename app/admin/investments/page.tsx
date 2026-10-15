/**
 * ADMIN → INVESTMENTS — the money ledger, line by line.
 *
 * Every row shows what came in, what is owed back, what Rydvest keeps and what
 * has actually been paid, so a single screen answers "does this tally?".
 *
 * Three checks run against each row and anything that fails is flagged at the
 * top and on the row itself:
 *
 *   schedule   the payout rows generated for an investment must add up to the
 *              return its plan promises — a mismatch means the schedule was
 *              written wrong, which no amount of later payouts will correct
 *   overpaid   paid-out payouts must never exceed the total due
 *   missing    a confirmed investment in a running pool must HAVE a schedule
 *
 * A clean page means every investment reconciles. A flagged one names the
 * investment, the expected figure and the actual, so it can be chased.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markInvestmentRefunded } from "@/app/actions/admin";
import { platformFee, PLATFORM_FEE_LABEL } from "@/lib/economics";
import { fmtNaira, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Investments · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  pending_payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  refund_pending: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  amount_mismatch: "bg-red-500/10 text-red-500 border-red-500/20",
};

/** Money only ever differs by rounding dust; anything above a kobo is real. */
const TOLERANCE = 0.01;

type Row = {
  id: string;
  amount: number;
  status: string;
  funding: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
  pool: {
    id: string;
    name: string;
    status: string;
    product: { name: string; roi_percent: number; duration_weeks: number } | null;
  } | null;
};

export default async function AdminInvestmentsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: investments }, { data: payouts }] = await Promise.all([
    admin
      .from("investments")
      .select(
        "id, amount, status, funding, payment_reference, paid_at, created_at, user:profiles(full_name, email), pool:pools(id, name, status, product:pool_products(name, roi_percent, duration_weeks))"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("payouts").select("investment_id, amount, status"),
  ]);

  // Scheduled vs paid, per investment.
  const scheduled = new Map<string, number>();
  const paidOut = new Map<string, number>();
  const weeksTotal = new Map<string, number>();
  const weeksDone = new Map<string, number>();

  for (const p of payouts ?? []) {
    const id = p.investment_id;
    const amt = Number(p.amount);
    scheduled.set(id, (scheduled.get(id) ?? 0) + amt);
    weeksTotal.set(id, (weeksTotal.get(id) ?? 0) + 1);
    if (p.status === "paid") {
      paidOut.set(id, (paidOut.get(id) ?? 0) + amt);
      weeksDone.set(id, (weeksDone.get(id) ?? 0) + 1);
    }
  }

  const rows = ((investments ?? []) as unknown as Row[]).map((inv) => {
    const product = inv.pool?.product ?? null;
    const roi = Number(product?.roi_percent ?? 0);
    const capital = Number(inv.amount);

    // What the plan promises back, to the kobo, the same way the SQL computes it.
    const dueToUser = Math.round(capital * (1 + roi / 100) * 100) / 100;
    const profitToUser = Math.round((dueToUser - capital) * 100) / 100;

    const poolFunded = inv.pool?.status === "active" || inv.pool?.status === "completed";
    const fee = platformFee(capital);

    const sched = scheduled.get(inv.id) ?? 0;
    const paid = paidOut.get(inv.id) ?? 0;
    const outstanding = Math.round((dueToUser - paid) * 100) / 100;
    const confirmed = inv.status === "paid";

    const issues: string[] = [];
    if (confirmed && (weeksTotal.get(inv.id) ?? 0) > 0 && Math.abs(sched - dueToUser) > TOLERANCE) {
      issues.push(
        `Schedule adds up to ${fmtNaira(sched)} but the plan promises ${fmtNaira(dueToUser)}`
      );
    }
    if (paid - dueToUser > TOLERANCE) {
      issues.push(`Paid ${fmtNaira(paid)}, which is more than the ${fmtNaira(dueToUser)} due`);
    }
    if (confirmed && poolFunded && (weeksTotal.get(inv.id) ?? 0) === 0) {
      issues.push("Pool is running but no payout schedule was generated");
    }

    return {
      inv,
      product,
      capital,
      dueToUser,
      profitToUser,
      fee,
      feeEarned: poolFunded,
      paid,
      outstanding,
      done: weeksDone.get(inv.id) ?? 0,
      weeks: weeksTotal.get(inv.id) ?? Number(product?.duration_weeks ?? 0),
      confirmed,
      issues,
    };
  });

  const confirmedRows = rows.filter((r) => r.confirmed);
  const totals = {
    capital: confirmedRows.reduce((s, r) => s + r.capital, 0),
    due: confirmedRows.reduce((s, r) => s + r.dueToUser, 0),
    profit: confirmedRows.reduce((s, r) => s + r.profitToUser, 0),
    fee: confirmedRows.filter((r) => r.feeEarned).reduce((s, r) => s + r.fee, 0),
    paid: confirmedRows.reduce((s, r) => s + r.paid, 0),
    outstanding: confirmedRows.reduce((s, r) => s + r.outstanding, 0),
  };

  const flagged = rows.filter((r) => r.issues.length > 0);

  return (
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Investments</h1>
            <p className="text-sm text-slate-500 mt-1">
              What came in, what is owed back, and what Rydvest keeps — checked against the payout
              schedule on every row.
            </p>
          </div>
        </div>

        {/* ── TOTALS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
          {[
            { label: "Capital in", value: fmtNaira(totals.capital), tone: "text-slate-900" },
            { label: "Due to investors", value: fmtNaira(totals.due), tone: "text-slate-900" },
            { label: "Investor profit", value: fmtNaira(totals.profit), tone: "text-blue-600" },
            { label: `Rydvest ${PLATFORM_FEE_LABEL}`, value: fmtNaira(totals.fee), tone: "text-green-600" },
            { label: "Paid out", value: fmtNaira(totals.paid), tone: "text-slate-900" },
            { label: "Still owed", value: fmtNaira(totals.outstanding), tone: "text-amber-600" },
          ].map((t) => (
            <div
              key={t.label}
              className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 px-4 py-3.5"
            >
              <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{t.label}</p>
              <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
                {t.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── RECONCILIATION ── */}
        <div
          className={`rounded-2xl border px-5 py-4 ${
            flagged.length === 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`shrink-0 mt-0.5 ${flagged.length === 0 ? "text-green-600" : "text-red-600"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {flagged.length === 0 ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                )}
              </svg>
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm font-extrabold ${
                  flagged.length === 0 ? "text-green-800" : "text-red-800"
                }`}
              >
                {flagged.length === 0
                  ? "Everything reconciles"
                  : `${flagged.length} investment${flagged.length === 1 ? "" : "s"} need${flagged.length === 1 ? "s" : ""} checking`}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  flagged.length === 0 ? "text-green-700/80" : "text-red-700/90"
                }`}
              >
                {flagged.length === 0
                  ? "Every confirmed investment's payout schedule matches the return its plan promises, and nothing has been overpaid."
                  : "Flagged rows are marked below with the expected figure and what was actually found."}
              </p>
            </div>
          </div>
        </div>

        {/* ── LEDGER ── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className={th}>Investor &amp; pool</th>
                  <th className={`${th} text-right`}>Capital</th>
                  <th className={`${th} text-right`}>Due to user</th>
                  <th className={`${th} text-right`}>Rydvest {PLATFORM_FEE_LABEL}</th>
                  <th className={`${th} text-right`}>Paid</th>
                  <th className={`${th} text-right`}>Outstanding</th>
                  <th className={th}>Progress</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                      No investments yet.
                    </td>
                  </tr>
                )}

                {rows.map((r) => (
                  <tr
                    key={r.inv.id}
                    className={r.issues.length > 0 ? "bg-red-50/50" : "hover:bg-slate-50/60 transition-colors"}
                  >
                    <td className={`${td} min-w-56`}>
                      <p className="text-sm font-bold text-slate-900">
                        {r.inv.user?.full_name || "—"}
                      </p>
                      <p className="text-xs text-slate-500">{r.inv.user?.email || "—"}</p>
                      <p className="text-xs text-slate-600 mt-1.5">
                        {r.inv.pool?.name || "—"}
                        {r.product && (
                          <span className="text-slate-400">
                            {" "}
                            · {Number(r.product.roi_percent)}% / {r.product.duration_weeks} wks
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400 mt-1 break-all">
                        {r.inv.payment_reference || "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {fmtDateTime(r.inv.paid_at ?? r.inv.created_at)}
                        {r.inv.funding === "gateway" && (
                          <span className="ml-1.5 text-slate-500">· gateway</span>
                        )}
                      </p>

                      {r.issues.map((issue) => (
                        <p
                          key={issue}
                          className="flex items-start gap-1.5 text-[11px] font-semibold text-red-700 mt-2"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          {issue}
                        </p>
                      ))}
                    </td>

                    <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(r.capital)}
                    </td>
                    <td className={`${td} text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(r.dueToUser)}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <p className="text-sm font-bold text-green-600 tabular-nums">
                        {fmtNaira(r.fee)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {r.feeEarned ? "earned" : "when pool fills"}
                      </p>
                    </td>
                    <td className={`${td} text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(r.paid)}
                    </td>
                    <td className={`${td} text-right text-sm font-bold tabular-nums whitespace-nowrap ${r.outstanding > 0 ? "text-amber-600" : "text-slate-400"}`}>
                      {fmtNaira(Math.max(0, r.outstanding))}
                    </td>

                    <td className={`${td} whitespace-nowrap`}>
                      {r.weeks > 0 ? (
                        <>
                          <p className="text-xs font-semibold text-slate-700">
                            {r.done} / {r.weeks} wks
                          </p>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-slate-100 mt-1.5">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-300"
                              style={{ width: `${Math.round((r.done / Math.max(1, r.weeks)) * 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Not started</span>
                      )}
                    </td>

                    <td className={`${td} whitespace-nowrap`}>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                          STATUS_STYLE[r.inv.status] ?? ""
                        }`}
                      >
                        {r.inv.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className={td}>
                      {r.inv.status === "refund_pending" && (
                        // Refund the charge in the payment dashboard first,
                        // then record it here.
                        <form action={markInvestmentRefunded}>
                          <input type="hidden" name="investmentId" value={r.inv.id} />
                          <button
                            type="submit"
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors whitespace-nowrap"
                          >
                            Mark refunded
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Showing the 200 most recent investments. Totals cover confirmed rows only — pending,
          refunded and mismatched contributions are listed but excluded from the figures above.
        </p>
      </div>
  );
}
