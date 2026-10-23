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
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvestForm, CreatePoolForm, JoinByInviteForm } from "@/components/dashboard/forms";
import { CopyCode } from "@/components/dashboard/CopyCode";
import { fmtNaira, poolProgressPct } from "@/lib/format";
import { vehicleImage } from "@/lib/vehicles";
import AssetBreakdown from "@/components/dashboard/AssetBreakdown";
import { PRIVATE_POOL_MINIMUM, poolMinimum } from "@/lib/economics";
import { ResponsiveMoney } from "@/components/BalanceToggle";

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
    description: string | null;
    target_amount: number;
    min_contribution: number;
    duration_weeks: number;
    roi_percent: number;
    active: boolean;
    image_path: string | null;
    // All five together or all null — the breakdown is all-or-nothing.
    asset_value: number | null;
    vat: number | null;
    service_charge: number | null;
    maintenance_fee: number | null;
    company_charge: number | null;
  } | null;
};

export default async function PoolsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: pools }, { data: balance }, { data: hasPin }] =
    await Promise.all([
    supabase
      .from("pool_products")
      // Only options meant for a private pool: this form is the only way a
      // user creates one, and a public option would carry the wrong minimum.
      .select("id, name, target_amount, duration_weeks, roi_percent, private_min_contribution")
      .eq("active", true)
      .in("availability", ["private", "both"])
      .order("target_amount", { ascending: true }),
    supabase
      .from("pools")
      .select(
        "id, name, amount_raised, is_private, invite_code, created_by, product:pool_products(name, description, target_amount, min_contribution, duration_weeks, roi_percent, active, image_path, asset_value, vat, service_charge, maintenance_fee, company_charge)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false }),
      supabase.rpc("my_available_balance"),
      supabase.rpc("has_transaction_pin"),
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
            const minimum = poolMinimum(Number(product.min_contribution), pool.is_private);

            return (
              <div
                key={pool.id}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 overflow-hidden flex flex-col"
              >
                {/* ── THE VEHICLE ──
                    A thumbnail beside the name rather than a banner above it.
                    Full-width photos pushed the actual decision — the figures
                    and the amount box — below the fold on a phone, and the
                    picture only has to say "keke, not minibus". */}
                <Link
                  href={`/dashboard/pools/${pool.id}`}
                  className="flex items-center gap-3.5 p-3.5 group hover:bg-slate-50/70 transition-colors"
                >
                  <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                    <Image
                      src={vehicleImage(product.name, product.image_path)}
                      alt={product.name}
                      fill
                      sizes="80px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-amber-600 transition-colors">
                      {pool.name}
                    </h3>
                    <p className="truncate text-xs text-slate-500">{product.name}</p>
                  </div>

                  <span
                    className={`${eyebrow} shrink-0 px-2.5 py-1 rounded-full border ${
                      pool.is_private
                        ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        : "bg-amber-400/15 text-amber-600 border-amber-400/30"
                    }`}
                  >
                    {pool.is_private ? "Private" : "Filling"}
                  </span>
                </Link>

                <div className="px-5 pb-5 flex flex-col flex-1">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "ROI", value: `${Number(product.roi_percent)}%`, tone: "text-green-600" },
                      { label: "Duration", value: `${product.duration_weeks} wks`, tone: "text-slate-900" },
                      // The figure this pool actually asks for, which on a
                      // private pool is the ₦500,000 floor, not the product's.
                      // Compact on a phone, where this column is ~66px wide.
                      {
                        label: "Min",
                        value: <ResponsiveMoney value={minimum} />,
                        tone: "text-slate-900",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-slate-50/80 border border-slate-100 rounded-xl px-2.5 sm:px-3 py-2.5 min-w-0"
                      >
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

                  <div className="mt-auto">
                    <InvestForm
                      poolId={pool.id}
                      minContribution={Number(product.min_contribution)}
                      isPrivate={pool.is_private}
                      remaining={remaining}
                      balance={walletBalance}
                      hasPin={Boolean(hasPin)}
                    />
                  </div>

                  {/* ── DETAILS, WITHOUT LEAVING THE PAGE ──
                      What the money buys, opened in place. Someone comparing
                      three pools should not have to visit three pages and come
                      back twice. Native <details>, so no client component and
                      it works with JavaScript off. */}
                  <details className="group/d mt-3 border-t border-slate-100 pt-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-700">
                      Details
                      <svg
                        className="h-3.5 w-3.5 transition-transform group-open/d:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </summary>

                    <div className="mt-3">
                      <AssetBreakdown product={product} compact />
                    </div>
                  </details>

                  {isCreator && pool.is_private && pool.invite_code && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className={`${eyebrow} text-slate-400 mb-1.5`}>Share to invite</p>
                      <CopyCode code={pool.invite_code} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── START / JOIN ── */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-5">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Start a private pool</h2>
          <p className="text-xs text-slate-500 mb-4">
            Share the invite code with the people you want in it. From{" "}
            {fmtNaira(PRIVATE_POOL_MINIMUM)} each. You can start another once this one is fully
            funded.
          </p>
          <CreatePoolForm
            products={(products ?? []).map((p) => ({
              id: p.id,
              name: `${p.name} · ${Number(p.roi_percent)}% · ${p.duration_weeks} weeks`,
              target_amount: Number(p.target_amount),
              // The slice THIS option asks for in a private pool, which is
              // what the user will actually have to put in.
              min_contribution: Math.max(
                Number(p.private_min_contribution ?? 0),
                PRIVATE_POOL_MINIMUM
              ),
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
