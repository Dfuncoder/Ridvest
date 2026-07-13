/**
 * PORTFOLIO — every investment the user has made, with pool, status,
 * expected return and earnings so far.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtNaira, fmtDate } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  pending_payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  refund_pending: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  amount_mismatch: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function PortfolioPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: investments }, { data: payouts }] = await Promise.all([
    supabase
      .from("investments")
      .select("id, amount, status, paid_at, created_at, pool:pools(id, name, status, product:pool_products(name, roi_percent, duration_weeks))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payouts")
      .select("investment_id, amount, status")
      .eq("user_id", user.id)
      .eq("status", "paid"),
  ]);

  const earnedByInvestment = new Map<string, number>();
  for (const p of payouts ?? []) {
    earnedByInvestment.set(p.investment_id, (earnedByInvestment.get(p.investment_id) ?? 0) + Number(p.amount));
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Portfolio</h1>
        <p className="text-sm text-slate-500">All your investments in one place.</p>
      </div>

      {(investments ?? []).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">No investments yet.</p>
          <Link href="/dashboard/invest" className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20">
            Start investing →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {(investments ?? []).map((inv) => {
            const pool = inv.pool as unknown as {
              id: string; name: string; status: string;
              product: { name: string; roi_percent: number; duration_weeks: number };
            };
            const roi = Number(pool.product.roi_percent);
            const expected = Math.round(Number(inv.amount) * (1 + roi / 100) * 100) / 100;
            const earned = earnedByInvestment.get(inv.id) ?? 0;
            return (
              <Link key={inv.id} href={`/dashboard/pools/${pool.id}`} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{pool.name}</p>
                  <p className="text-xs text-slate-400">
                    {pool.product.name} · {roi}% / {pool.product.duration_weeks} wks · {fmtDate(inv.paid_at ?? inv.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Invested</p>
                    <p className="text-sm font-extrabold text-slate-900 tabular-nums">{fmtNaira(inv.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Earned</p>
                    <p className="text-sm font-extrabold text-green-600 tabular-nums">{fmtNaira(earned)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Expected</p>
                    <p className="text-sm font-extrabold text-slate-900 tabular-nums">{fmtNaira(expected)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize shrink-0 ${STATUS_STYLE[inv.status] ?? ""}`}>
                    {inv.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
