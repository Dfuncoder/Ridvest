/**
 * POOL DETAIL — progress, how much is in / remaining, my contributions, and
 * an invest form while the pool is open.
 *
 * Access control (private pools):
 *   • public pool           → any logged-in user
 *   • member / creator      → always
 *   • holder of the invite  → via ?code=XXXXXXXX (that's how friends join)
 *   Anyone else gets a 404-style message. Uses the admin client because an
 *   invited friend isn't a member yet, so RLS alone would hide the pool.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InvestForm } from "@/components/dashboard/forms";
import { fmtNaira, fmtDate, poolProgressPct } from "@/lib/format";

export default async function PoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { code } = await searchParams;

  const admin = createSupabaseAdminClient();
  const { data: pool } = await admin
    .from("pools")
    .select("id, name, status, amount_raised, is_private, invite_code, created_by, started_at, ends_at, product:pool_products(name, target_amount, min_contribution, duration_months, roi_percent)")
    .eq("id", id)
    .single();

  // My investments in this pool (also proves membership for access).
  const { data: myInvestments } = pool
    ? await admin
        .from("investments")
        .select("id, amount, status, paid_at")
        .eq("pool_id", pool.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const isMember = (myInvestments ?? []).length > 0;
  const isCreator = pool?.created_by === user.id;
  const hasValidCode = Boolean(pool?.invite_code && code && code.toUpperCase() === pool.invite_code);
  const canView = pool && (!pool.is_private || isMember || isCreator || hasValidCode);

  if (!pool || !canView) {
    return (
      <div className="max-w-md mx-auto py-10 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <p className="text-sm text-slate-500 mb-4">
            This pool doesn't exist, or it's private and you don't have access.
          </p>
          <Link href="/dashboard/pools" className="text-amber-500 font-semibold text-sm">← Back to my pools</Link>
        </div>
      </div>
    );
  }

  const product = pool.product as unknown as {
    name: string; target_amount: number; min_contribution: number;
    duration_months: number; roi_percent: number;
  };
  const raised = Number(pool.amount_raised);
  const target = Number(product.target_amount);
  const remaining = target - raised;
  const pct = poolProgressPct(raised, target);
  const myTotal = (myInvestments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <Link href="/dashboard/pools" className="text-xs text-slate-500 hover:text-slate-700">← My pools</Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">{pool.name}</h1>
            <p className="text-sm text-slate-500">
              {product.name} · {Number(product.roi_percent)}% total return over {product.duration_months} months
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 capitalize ${
            pool.status === "open" ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
            : pool.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20"
            : "bg-slate-500/10 text-slate-500 border-slate-500/20"
          }`}>
            {pool.status === "open" ? "Filling" : pool.status}
          </span>
        </div>

        {/* Fill progress — how much is in, and what's left. */}
        <div className="my-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">
              <span className="font-extrabold text-slate-900">{fmtNaira(raised)}</span> raised
            </span>
            <span className="text-slate-500">
              <span className="font-extrabold text-amber-500">{fmtNaira(Math.max(0, remaining))}</span> remaining
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {pct}% of {fmtNaira(target)} — the pool starts running (and payouts get scheduled) the moment it's 100% filled.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "My stake", value: fmtNaira(myTotal) },
            { label: "Min contribution", value: fmtNaira(product.min_contribution) },
            { label: "Started", value: pool.started_at ? fmtDate(pool.started_at) : "Not yet" },
            { label: "Ends", value: pool.ends_at ? fmtDate(pool.ends_at) : "—" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="text-sm font-extrabold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Invite code — shown to the creator of a private pool to share. */}
        {pool.is_private && isCreator && pool.status === "open" && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 mb-1 font-semibold">Share this invite code with friends:</p>
            <p className="font-mono text-xl font-extrabold tracking-[0.3em] text-amber-600">{pool.invite_code}</p>
          </div>
        )}

        {/* Invest while open. */}
        {pool.status === "open" && remaining > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-extrabold text-slate-900 mb-1">Add money to this pool</h2>
            <InvestForm poolId={pool.id} minContribution={Number(product.min_contribution)} remaining={remaining} />
          </div>
        )}
      </div>

      {/* My contributions to this pool */}
      {(myInvestments ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">My contributions</h2>
          <div className="divide-y divide-slate-100">
            {(myInvestments ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{fmtNaira(inv.amount)}</p>
                  <p className="text-xs text-slate-400">{inv.paid_at ? fmtDate(inv.paid_at) : "Awaiting payment"}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                  inv.status === "paid" ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : inv.status === "pending_payment" ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>
                  {inv.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
