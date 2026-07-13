/**
 * ADMIN → POOL OPTIONS — create the investment products users can pool into
 * (e.g. "Keke Napep" at ₦2.5m, 52 weeks, 50% ROI) and enable/disable them.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toggleProductActive } from "@/app/actions/admin";
import ProductForm from "@/components/admin/ProductForm";
import { fmtNaira } from "@/lib/format";

export default async function AdminProductsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: products } = await admin
    .from("pool_products")
    .select("id, name, description, target_amount, min_contribution, duration_weeks, roi_percent, active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Pool options</h1>
        <p className="text-sm text-slate-500">
          The investment products users can join pools for. Disabling one stops new investments; running pools are unaffected.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* Create */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4">New pool option</h2>
          <ProductForm />
        </div>

        {/* Existing */}
        <div className="flex flex-col gap-3">
          {(products ?? []).length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-500">No pool options yet — create the first one.</p>
            </div>
          )}
          {(products ?? []).map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{p.name}</h3>
                  {p.description && <p className="text-xs text-slate-400">{p.description}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  p.active
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                }`}>
                  {p.active ? "Active" : "Disabled"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Price", value: fmtNaira(p.target_amount) },
                  { label: "Min", value: fmtNaira(p.min_contribution) },
                  { label: "Duration", value: `${p.duration_weeks} wks` },
                  { label: "ROI", value: `${Number(p.roi_percent)}%` },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</p>
                    <p className="text-xs font-extrabold text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>

              <form action={toggleProductActive}>
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="active" value={String(!p.active)} />
                <button type="submit" className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                  p.active
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                }`}>
                  {p.active ? "Disable" : "Enable"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
