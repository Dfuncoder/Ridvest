/**
 * ABOUT THIS ASSET — what the money buys, and what comes back.
 *
 * Shown on a pool page so somebody deciding whether to put ₦500,000 in can
 * see the vehicle's price, the charges on top, and the return, instead of one
 * figure with no working.
 *
 * Two groups on purpose. The first adds up to what is being raised; the
 * second is what that turns into. Mixing them would invite reading the payout
 * as part of the cost.
 *
 * The earnings rate applies to the TOTAL PACKAGE, not to the asset value alone — the total
 * is what an investor actually puts in, so it is what the return is measured
 * against. (Worth knowing: the competitor page this was modelled on shows a
 * profit figure taken from the asset value while charging for the package,
 * which makes their stated ROI look better than it is.)
 */
import { fmtNaira } from "@/lib/format";
import { assetReturns } from "@/lib/economics";

type Product = {
  name: string;
  description: string | null;
  target_amount: number;
  duration_weeks: number;
  roi_percent: number;
  asset_value: number | null;
  vat: number | null;
  service_charge: number | null;
  maintenance_fee: number | null;
  company_charge: number | null;
};

function Line({
  label,
  value,
  strong = false,
  tone = "",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        strong ? "border-t border-slate-200 mt-1 pt-2.5" : ""
      }`}
    >
      <dt className={`text-xs ${strong ? "font-bold text-slate-700" : "text-slate-500"}`}>
        {label}
      </dt>
      <dd
        className={`tabular-nums text-right ${
          strong ? "text-sm font-extrabold" : "text-xs font-semibold"
        } ${tone || "text-slate-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function AssetBreakdown({ product }: { product: Product }) {
  const total = Number(product.target_amount);
  const roi = Number(product.roi_percent);
  const { profit, totalPayout } = assetReturns(total, roi);

  // All five or none — the database enforces that, so testing one is enough.
  const itemised = product.asset_value !== null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
        </svg>
        <h2 className="text-sm font-extrabold text-slate-900">About this asset</h2>
      </div>

      {/* The product name is deliberately NOT repeated here — the page header
          above already carries it under the pool's own name, and printing it
          twice invites reading them as two different things. */}
      {product.description && (
        <p className="mb-4 text-sm leading-relaxed text-slate-600">{product.description}</p>
      )}

      {itemised && (
        <dl className="mb-5">
          <Line label="Asset value" value={fmtNaira(product.asset_value ?? 0)} />
          <Line label="VAT" value={fmtNaira(product.vat ?? 0)} />
          <Line label="Service charge" value={fmtNaira(product.service_charge ?? 0)} />
          <Line label="Maintenance fee" value={fmtNaira(product.maintenance_fee ?? 0)} />
          <Line label="Company's charge" value={fmtNaira(product.company_charge ?? 0)} />
          <Line label="Total package" value={fmtNaira(total)} strong />
        </dl>
      )}

      <dl className="rounded-xl bg-slate-50/80 border border-slate-100 px-4 py-2">
        {!itemised && <Line label="Total package" value={fmtNaira(total)} />}
        <Line label="Total earnings" value={`${roi}%`} tone="text-green-600" />
        <Line label="Your profit" value={fmtNaira(profit)} tone="text-green-600" />
        <Line label="Total payout" value={fmtNaira(totalPayout)} strong tone="text-green-600" />
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        Hire purchase duration:{" "}
        <span className="font-semibold text-slate-900">{product.duration_weeks} weeks</span>
      </p>
    </div>
  );
}
