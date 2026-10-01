/**
 * POOLS — the one place to put money into a pool.
 *
 * Every pool that is still open and visible to this user: public pools anyone
 * can join, plus private pools they created or are already in. Pools they have
 * already funded live under Investments, not here.
 *
 * RLS decides visibility ("pools: read public, member or admin"), so this page
 * simply asks for open pools and shows what comes back.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvestForm, CreatePoolForm, JoinByInviteForm } from "@/components/dashboard/forms";
import { CopyCode } from "@/components/dashboard/CopyCode";
import { fmtNaira, poolProgressPct } from "@/lib/format";

export const metadata = { title: "Pools · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

type OpenPool = {
  id: string;
  name: string;
  amount_raised: number;
  is_private: boolean;
  invite_code: string | null;
  created_by: string | null;
  product: {
    name: string;
    target_amount: number;
    min_contribution: number;
    duration_weeks: number;
    roi_percent: number;
    active: boolean;
  } | null;
};

export default async function PoolsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: pools }, { data: balance }] = await Promise.all([
    supabase
      .from("pool_products")
      .select("id, name, target_amount, duration_weeks, roi_percent")
      .eq("active", true)
      .order("target_amount", { ascending: true }),
    supabase
      .from("pools")
      .select(
        "id, name, amount_raised, is_private, invite_code, created_by, product:pool_products(name, target_amount, min_contribution, duration_weeks, roi_percent, active)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.rpc("my_available_balance"),
  ]);

  const walletBalance = Number(balance ?? 0);
  const openPools = ((pools ?? []) as unknown as OpenPool[]).filter((p) => p.product?.active);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pools</h1>
        <p className="text-sm text-slate-500 mt-1">
          Join a pool below. It starts earning once it&apos;s fully funded.
        </p>
      </div>

      {/* ── BALANCE ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className={`${eyebrow} text-slate-400 mb-1`}>Your balance</p>
          <p className="text-xl font-extrabold text-slate-900 tabular-nums tracking-tight">
            {fmtNaira(walletBalance)}
          </p>
        </div>
        <Link
          href="/dashboard/deposit"
          className="shrink-0 px-5 py-3 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20"
        >
          Deposit
        </Link>
      </div>

      {/* ── OPEN POOLS ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">
          Open to join
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {openPools.length === 0 && (
            <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-10 text-center">
              <p className="text-sm text-slate-500">
                No pools are open right now — start one below and invite others to fill it.
              </p>
            </div>
          )}

          {openPools.map((pool) => {
            const product = pool.product!;
            const raised = Number(pool.amount_raised);
            const target = Number(product.target_amount);
            const remaining = target - raised;
            const pct = poolProgressPct(raised, target);
            const isCreator = pool.created_by === user.id;

            return (
              <div
                key={pool.id}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/pools/${pool.id}`}
                      className="text-sm font-extrabold text-slate-900 tracking-tight hover:text-amber-600 transition-colors"
                    >
                      {pool.name}
                    </Link>
                    <p className="text-xs text-slate-500">{product.name}</p>
                  </div>
                  <span
                    className={`${eyebrow} px-2 py-0.5 rounded-full border shrink-0 ${
                      pool.is_private
                        ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    }`}
                  >
                    {pool.is_private ? "Private" : "Filling"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "ROI", value: `${Number(product.roi_percent)}%`, tone: "text-green-600" },
                    { label: "Duration", value: `${product.duration_weeks} wks`, tone: "text-slate-900" },
                    { label: "Min", value: fmtNaira(product.min_contribution), tone: "text-slate-900" },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2.5">
                      <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{s.label}</p>
                      <p className={`text-sm font-extrabold tabular-nums ${s.tone}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{fmtNaira(raised)} raised</span>
                    <span className="font-bold text-slate-900">
                      {pct}% of {fmtNaira(target)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-300 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <InvestForm
                  poolId={pool.id}
                  minContribution={Number(product.min_contribution)}
                  remaining={remaining}
                  balance={walletBalance}
                />

                {isCreator && pool.is_private && pool.invite_code && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className={`${eyebrow} text-slate-400 mb-1.5`}>Share to invite</p>
                    <CopyCode code={pool.invite_code} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── START / JOIN ── */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Start a new pool</h2>
          <p className="text-xs text-slate-500 mb-4">
            Make it private and share the invite code with people you choose. You can start another
            once this one is fully funded.
          </p>
          <CreatePoolForm
            products={(products ?? []).map((p) => ({
              id: p.id,
              name: `${p.name} · ${Number(p.roi_percent)}% · ${p.duration_weeks} weeks`,
              target_amount: Number(p.target_amount),
            }))}
          />
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Have an invite code?</h2>
          <p className="text-xs text-slate-500 mb-4">
            Enter the code someone shared with you to join their private pool.
          </p>
          <JoinByInviteForm />
        </div>
      </section>
    </div>
  );
}
