/**
 * MY POOLS — every pool the user has money in or created, with fill/run
 * progress. Links through to the pool detail page.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtNaira, fmtDate, poolProgressPct } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function PoolsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // Pools I've invested in + pools I created (RLS also permits both).
  const [{ data: myInvestments }, { data: myCreated }] = await Promise.all([
    supabase
      .from("investments")
      .select("pool_id, amount, status")
      .eq("user_id", user.id)
      .eq("status", "paid"),
    supabase
      .from("pools")
      .select("id")
      .eq("created_by", user.id),
  ]);

  const myAmounts = new Map<string, number>();
  for (const inv of myInvestments ?? []) {
    myAmounts.set(inv.pool_id, (myAmounts.get(inv.pool_id) ?? 0) + Number(inv.amount));
  }
  const poolIds = [
    ...new Set([...myAmounts.keys(), ...(myCreated ?? []).map((p) => p.id)]),
  ];

  const { data: pools } = poolIds.length
    ? await supabase
        .from("pools")
        .select("id, name, status, amount_raised, is_private, invite_code, created_by, started_at, ends_at, product:pool_products(name, target_amount, duration_months, roi_percent)")
        .in("id", poolIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">My pools</h1>
          <p className="text-sm text-slate-500">Pools you've joined or created.</p>
        </div>
        <Link href="/dashboard/invest" className="bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-400/20 whitespace-nowrap">
          + New pool
        </Link>
      </div>

      {(pools ?? []).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">You're not in any pools yet.</p>
          <Link href="/dashboard/invest" className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20">
            Browse open pools →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(pools ?? []).map((pool) => {
            const product = pool.product as unknown as {
              name: string; target_amount: number; duration_months: number; roi_percent: number;
            };
            const pct = poolProgressPct(Number(pool.amount_raised), Number(product.target_amount));
            const mine = myAmounts.get(pool.id) ?? 0;
            return (
              <Link key={pool.id} href={`/dashboard/pools/${pool.id}`} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow block">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-slate-900 truncate">{pool.name}</h2>
                    <p className="text-xs text-slate-500">
                      {product.name} · {Number(product.roi_percent)}% over {product.duration_months} months
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 capitalize ${STATUS_BADGE[pool.status] ?? ""}`}>
                    {pool.status === "open" ? "Filling" : pool.status}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{fmtNaira(pool.amount_raised)} of {fmtNaira(product.target_amount)}</span>
                    <span className="font-semibold text-slate-900">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>My stake: <span className="font-bold text-slate-900">{fmtNaira(mine)}</span></span>
                  {pool.status === "active" && pool.ends_at && <span>Ends {fmtDate(pool.ends_at)}</span>}
                  {pool.status === "open" && pool.created_by === user.id && pool.is_private && (
                    <span className="font-mono font-bold text-amber-500">Code: {pool.invite_code}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
