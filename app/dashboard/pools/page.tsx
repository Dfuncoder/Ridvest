/**
 * POOLS — the pools the user has money in or created, plus every open PUBLIC
 * pool anyone can join. RLS already exposes public pools to all logged-in
 * users (see "pools: read public, member or admin"); this page asks for them.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CopyCode } from "@/components/dashboard/CopyCode";
import { fmtNaira, fmtDate, poolProgressPct } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  completed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};
type PoolRow = {
  id: string;
  name: string;
  status: string;
  amount_raised: number;
  is_private: boolean;
  invite_code: string | null;
  created_by: string | null;
  started_at: string | null;
  ends_at: string | null;
  product: unknown;
};

function PoolCard({
  pool,
  mine,
  isCreator,
}: {
  pool: PoolRow;
  /** How much of this pool is the viewer's own money. */
  mine: number;
  /** Only the creator of a private pool sees its invite code. */
  isCreator: boolean;
}) {
  const product = pool.product as {
    name: string;
    target_amount: number;
    duration_weeks: number;
    roi_percent: number;
  };
  const pct = poolProgressPct(Number(pool.amount_raised), Number(product.target_amount));

  return (
    <Link
      href={`/dashboard/pools/${pool.id}`}
      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm shadow-slate-200/40 hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-150 block"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900 truncate">{pool.name}</h3>
          <p className="text-xs text-slate-500">
            {product.name} · {Number(product.roi_percent)}% over {product.duration_weeks} weeks
          </p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 capitalize ${
            STATUS_BADGE[pool.status] ?? ""
          }`}
        >
          {pool.status === "open" ? "Filling" : pool.status}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>
            {fmtNaira(pool.amount_raised)} of {fmtNaira(product.target_amount)}
          </span>
          <span className="font-semibold text-slate-900">{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-300 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        {mine > 0 ? (
          <span>
            My stake: <span className="font-bold text-slate-900">{fmtNaira(mine)}</span>
          </span>
        ) : (
          <span className="text-slate-400">Open to join</span>
        )}
        {pool.status === "active" && pool.ends_at && <span>Ends {fmtDate(pool.ends_at)}</span>}
        {isCreator && pool.is_private && pool.invite_code && (
          <CopyCode code={pool.invite_code} />
        )}
      </div>
    </Link>
  );
}

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

  const POOL_FIELDS =
    "id, name, status, amount_raised, is_private, invite_code, created_by, started_at, ends_at, product:pool_products(name, target_amount, duration_weeks, roi_percent)";

  const [{ data: pools }, { data: publicPools }] = await Promise.all([
    poolIds.length
      ? supabase
          .from("pools")
          .select(POOL_FIELDS)
          .in("id", poolIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    // Open public pools anyone can join. RLS allows these to every logged-in
    // user; the ones this user is already in are filtered out below.
    supabase
      .from("pools")
      .select(POOL_FIELDS)
      .eq("status", "open")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const mineIds = new Set(poolIds);
  const openToJoin = (publicPools ?? []).filter((p) => !mineIds.has(p.id));

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Pools</h1>
          <p className="text-sm text-slate-500 mt-0.5">Yours, and others open to join.</p>
        </div>
        <Link href="/dashboard/invest" className="bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-400/20 whitespace-nowrap">
          + New pool
        </Link>
      </div>

      {(pools ?? []).length === 0 && openToJoin.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">There are no pools to show yet.</p>
          <Link href="/dashboard/invest" className="inline-block bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-amber-400/20">
            Start a pool →
          </Link>
        </div>
      ) : (
        <>
          {(pools ?? []).length > 0 && (
            <section>
              <h2 className="text-sm font-extrabold text-slate-900 mb-3">My pools</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {(pools ?? []).map((pool) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool as unknown as PoolRow}
                    mine={myAmounts.get(pool.id) ?? 0}
                    isCreator={pool.created_by === user.id}
                  />
                ))}
              </div>
            </section>
          )}

          {openToJoin.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="text-sm font-extrabold text-slate-900">Open to join</h2>
                <p className="text-xs text-slate-400">Public pools still filling up</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {openToJoin.map((pool) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool as unknown as PoolRow}
                    mine={0}
                    isCreator={pool.created_by === user.id}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
