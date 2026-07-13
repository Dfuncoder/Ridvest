/**
 * INVEST — browse open pools and put money in, create a new pool (public or
 * private for friends), or join a private pool with an invite code.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvestForm, CreatePoolForm, JoinByInviteForm } from "@/components/dashboard/forms";
import { fmtNaira, poolProgressPct } from "@/lib/format";

export default async function InvestPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  // RLS: active products; open PUBLIC pools (private ones stay hidden unless
  // the user is already a member).
  const [{ data: products }, { data: pools }] = await Promise.all([
    supabase
      .from("pool_products")
      .select("id, name, description, target_amount, min_contribution, duration_weeks, roi_percent")
      .eq("active", true)
      .order("target_amount", { ascending: true }),
    supabase
      .from("pools")
      .select("id, name, status, amount_raised, is_private, product:pool_products(id, name, target_amount, min_contribution, duration_weeks, roi_percent, active)")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  const openPools = (pools ?? []).filter((p) => {
    const product = p.product as unknown as { active: boolean } | null;
    return product?.active && !p.is_private;
  });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Invest</h1>
        <p className="text-sm text-slate-500">
          Join an open pool below — the pool starts earning the moment it's fully funded.
        </p>
      </div>

      {/* ── OPEN POOLS ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {openPools.length === 0 && (
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">
              No open pools right now — create one below and invite others to fill it.
            </p>
          </div>
        )}
        {openPools.map((pool) => {
          const product = pool.product as unknown as {
            id: string; name: string; target_amount: number; min_contribution: number;
            duration_weeks: number; roi_percent: number;
          };
          const raised = Number(pool.amount_raised);
          const target = Number(product.target_amount);
          const remaining = target - raised;
          const pct = poolProgressPct(raised, target);
          return (
            <div key={pool.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{pool.name}</h2>
                  <p className="text-xs text-slate-500">{product.name}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                  Filling
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 my-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">ROI</p>
                  <p className="text-sm font-extrabold text-green-600">{Number(product.roi_percent)}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Duration</p>
                  <p className="text-sm font-extrabold text-slate-900">{product.duration_weeks} wks</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Min</p>
                  <p className="text-sm font-extrabold text-slate-900">{fmtNaira(product.min_contribution)}</p>
                </div>
              </div>

              {/* Fill progress */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>{fmtNaira(raised)} raised</span>
                  <span className="font-semibold text-slate-900">{pct}% of {fmtNaira(target)}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <InvestForm poolId={pool.id} minContribution={Number(product.min_contribution)} remaining={remaining} />
            </div>
          );
        })}
      </div>

      {/* ── CREATE / JOIN ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Start a new pool</h2>
          <p className="text-xs text-slate-500 mb-4">
            Open your own pool — make it private and share the invite code with friends you want to invest with.
          </p>
          <CreatePoolForm
            products={(products ?? []).map((p) => ({
              id: p.id,
              name: `${p.name} · ${Number(p.roi_percent)}% · ${p.duration_weeks} weeks`,
              target_amount: Number(p.target_amount),
            }))}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Have an invite code?</h2>
          <p className="text-xs text-slate-500 mb-4">
            Enter the code a friend shared with you to join their private pool.
          </p>
          <JoinByInviteForm />
        </div>
      </div>
    </div>
  );
}
