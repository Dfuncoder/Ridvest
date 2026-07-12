/**
 * ADMIN → POOLS — every pool with fill progress; open official pools;
 * cancel empty open pools.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createOfficialPool, cancelPool } from "@/app/actions/admin";
import { fmtNaira, fmtDate, poolProgressPct } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function AdminPoolsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: pools }, { data: products }] = await Promise.all([
    admin
      .from("pools")
      .select("id, name, status, amount_raised, is_private, invite_code, started_at, ends_at, created_at, creator:profiles!pools_created_by_fkey(full_name), product:pool_products(name, target_amount)")
      .order("created_at", { ascending: false }),
    admin
      .from("pool_products")
      .select("id, name, target_amount")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Pools</h1>
        <p className="text-sm text-slate-500">Every pool on the platform, with live fill progress.</p>
      </div>

      {/* Open an official pool */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">Open an official pool</h2>
        <form action={createOfficialPool} className="flex gap-2 max-w-md">
          <select name="productId" required defaultValue="" className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-amber-400">
            <option value="" disabled>Choose a pool option</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {fmtNaira(p.target_amount)}</option>
            ))}
          </select>
          <button type="submit" className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-sm rounded-xl transition-all">
            Open pool
          </button>
        </form>
      </div>

      {/* All pools */}
      <div className="flex flex-col gap-3">
        {(pools ?? []).map((pool) => {
          const product = pool.product as unknown as { name: string; target_amount: number };
          const creator = pool.creator as unknown as { full_name: string } | null;
          const pct = poolProgressPct(Number(pool.amount_raised), Number(product.target_amount));
          const canCancel = pool.status === "open" && Number(pool.amount_raised) === 0;
          return (
            <div key={pool.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">{pool.name}</h3>
                  <p className="text-xs text-slate-400">
                    {product.name} · created {fmtDate(pool.created_at)}
                    {creator ? ` by ${creator.full_name}` : " (official)"}
                    {pool.is_private && ` · private (code ${pool.invite_code})`}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 capitalize ${STATUS_BADGE[pool.status] ?? ""}`}>
                  {pool.status === "open" ? "Filling" : pool.status}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{fmtNaira(pool.amount_raised)} of {fmtNaira(product.target_amount)}</span>
                <span className="font-semibold text-slate-900">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {pool.started_at ? `Running: ${fmtDate(pool.started_at)} → ${fmtDate(pool.ends_at)}` : "Not started"}
                </p>
                {canCancel && (
                  <form action={cancelPool}>
                    <input type="hidden" name="poolId" value={pool.id} />
                    <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                      Cancel pool
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
