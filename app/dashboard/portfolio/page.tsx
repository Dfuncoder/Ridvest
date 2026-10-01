/**
 * INVESTMENTS — every pool this user has money in, with what they put in, what
 * has been paid, what is due next and what the position is worth at maturity.
 * Browsing and joining pools is /dashboard/pools; this page is only their own
 * positions.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtNaira, fmtDate } from "@/lib/format";

export const metadata = { title: "Investments · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  pending_payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  refund_pending: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  amount_mismatch: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function InvestmentsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: investments }, { data: payouts }] = await Promise.all([
    supabase
      .from("investments")
      .select(
        "id, amount, status, paid_at, created_at, pool:pools(id, name, status, product:pool_products(name, roi_percent, duration_weeks))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    // All payouts, not just paid ones: the next scheduled one is needed too.
    supabase
      .from("payouts")
      .select("investment_id, amount, status, due_date")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
  ]);

  const earnedByInvestment = new Map<string, number>();
  const nextByInvestment = new Map<string, { amount: number; date: string }>();
  const weeksByInvestment = new Map<string, { done: number; total: number }>();

  for (const p of payouts ?? []) {
    const weeks = weeksByInvestment.get(p.investment_id) ?? { done: 0, total: 0 };
    weeks.total += 1;
    if (p.status === "paid") {
      weeks.done += 1;
      earnedByInvestment.set(
        p.investment_id,
        (earnedByInvestment.get(p.investment_id) ?? 0) + Number(p.amount)
      );
    } else if (!nextByInvestment.has(p.investment_id)) {
      // Ordered by due_date, so the first unpaid one is the next one due.
      nextByInvestment.set(p.investment_id, {
        amount: Number(p.amount),
        date: p.due_date,
      });
    }
    weeksByInvestment.set(p.investment_id, weeks);
  }

  const rows = investments ?? [];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Investments</h1>
        <p className="text-sm text-slate-500 mt-1">Every pool you have money in.</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-10 text-center">
          <p className="text-sm text-slate-500 mb-5">No investments yet.</p>
          <Link
            href="/dashboard/pools"
            className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-400/20"
          >
            Browse pools →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((inv) => {
            // An embedded relation is null when RLS hides the row, so read it
            // defensively rather than letting the page 500.
            const pool = inv.pool as unknown as {
              id: string;
              name: string;
              status: string;
              product: { name: string; roi_percent: number; duration_weeks: number } | null;
            } | null;
            if (!pool) return null;

            const product = pool.product;
            const roi = Number(product?.roi_percent ?? 0);
            const expected = Math.round(Number(inv.amount) * (1 + roi / 100) * 100) / 100;
            const earned = earnedByInvestment.get(inv.id) ?? 0;
            const next = nextByInvestment.get(inv.id);
            const weeks = weeksByInvestment.get(inv.id);
            const pct = expected > 0 ? Math.min(100, Math.round((earned / expected) * 100)) : 0;

            return (
              <Link
                key={inv.id}
                href={`/dashboard/pools/${pool.id}`}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-5 block transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                      {pool.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {product
                        ? `${product.name} · ${roi}% over ${product.duration_weeks} weeks`
                        : "Pool option no longer listed"}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize shrink-0 ${
                      STATUS_STYLE[inv.status] ?? ""
                    }`}
                  >
                    {inv.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2.5">
                    <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>Invested</p>
                    <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {fmtNaira(inv.amount)}
                    </p>
                  </div>
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2.5">
                    <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>Earned</p>
                    <p className="text-sm font-extrabold text-green-600 tabular-nums">
                      {fmtNaira(earned)}
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                    <p className={`${eyebrow} text-amber-500/80 mb-1 leading-tight`}>Next payout</p>
                    <p className="text-sm font-extrabold text-amber-600 tabular-nums">
                      {next ? fmtNaira(next.amount) : "—"}
                    </p>
                    {next && (
                      <p className="text-[10px] text-amber-600/70 mt-0.5">{fmtDate(next.date)}</p>
                    )}
                  </div>
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2.5">
                    <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>Total expected</p>
                    <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {fmtNaira(expected)}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>
                      {weeks && weeks.total > 0
                        ? `Week ${weeks.done} of ${weeks.total}`
                        : inv.status === "paid"
                          ? "Waiting for the pool to fill"
                          : "Not started"}
                    </span>
                    <span className="font-bold text-slate-900">{pct}% paid</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-300 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
