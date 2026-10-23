"use client";

/**
 * Admin form for creating a pool option (product): name (e.g. "Keke Napep"),
 * pool price, minimum contribution, duration and ROI %.
 */
import { useActionState, useState } from "react";
import Image from "next/image";
import { createProduct } from "@/app/actions/admin";
import { VEHICLES } from "@/lib/vehicles";
import { PRIVATE_POOL_MINIMUM } from "@/lib/economics";
import { fmtNaira } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

/**
 * A naira input that reads like money while you type.
 *
 * The visible box carries NO name — it holds "2,500,000", and a server action
 * receiving that would coerce it to NaN. The hidden field beside it carries
 * the raw digits under the real name, so nothing downstream has to know this
 * formatting happened. Same contract as MoneyInput on the user side.
 */
function NairaField({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  readOnly,
  className,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  const display = value === "" ? "" : Number(value).toLocaleString("en-NG");

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={className}
      />
    </>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

export default function ProductForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProduct, undefined);
  const [picked, setPicked] = useState("");
  const [availability, setAvailability] = useState("both");
  const [targetAmount, setTargetAmount] = useState("");
  const [minContribution, setMinContribution] = useState("");
  const [privateMin, setPrivateMin] = useState("");
  const [parts, setParts] = useState<Record<string, string>>({
    assetValue: "",
    vat: "",
    serviceCharge: "",
    maintenanceFee: "",
    companyCharge: "",
  });

  const breakdownTotal = Object.values(parts).reduce((s, v) => s + (Number(v) || 0), 0);
  // "Itemised" means at least one part was entered. The server and the
  // database both require all five to reconcile once that is true.
  const itemised = breakdownTotal > 0;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.message && (
        <p className={`text-xs rounded-xl px-3.5 py-2.5 border ${
          state.success ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"
        }`}>
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="pp-name" className={label}>Name</label>
        <input id="pp-name" name="name" type="text" required placeholder="e.g. Keke Napep" className={input} />
        <FieldErr msg={state?.errors?.name} />
      </div>

      <div>
        <label htmlFor="pp-desc" className={label}>Description (optional)</label>
        <input id="pp-desc" name="description" type="text" maxLength={500} placeholder="Short description shown to owners" className={input} />
      </div>

      {/* The photo investors see on the pool card. Left on "Match the name"
          it is worked out from the product name, which is right almost
          always — pick one explicitly when the name is unusual. */}
      <div>
        <span className={label}>Photo on the pool card</span>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`relative flex items-center justify-center h-20 rounded-xl border-2 cursor-pointer transition-colors text-center px-2 ${
              picked === "" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="imagePath"
              value=""
              checked={picked === ""}
              onChange={() => setPicked("")}
              className="sr-only"
            />
            <span className="text-[11px] font-bold text-slate-600 leading-tight">
              Match the name
              <span className="block font-medium text-slate-400">automatic</span>
            </span>
          </label>

          {VEHICLES.map((v) => (
            <label
              key={v.path}
              className={`relative h-20 rounded-xl border-2 cursor-pointer overflow-hidden transition-colors ${
                picked === v.path ? "border-amber-400" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="imagePath"
                value={v.path}
                checked={picked === v.path}
                onChange={() => setPicked(v.path)}
                className="sr-only"
              />
              <Image src={v.path} alt={v.label} fill sizes="200px" className="object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-2 pt-4 pb-1.5 text-[10px] font-bold text-white leading-tight">
                {v.label}
              </span>
            </label>
          ))}
        </div>
        <FieldErr msg={state?.errors?.imagePath} />
      </div>

      {/* Which kind of pool this option is for. Without this every option
          showed up in both places, and a public option with a ₦50,000 minimum
          would appear when a user went to start a private pool. */}
      <div>
        <span className={label}>Available for</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "both", title: "Both", hint: "Either kind" },
            { value: "public", title: "Official only", hint: "Admin opens it" },
            { value: "private", title: "Private only", hint: "Users start it" },
          ].map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center transition-colors ${
                availability === o.value
                  ? "border-amber-400 bg-amber-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="availability"
                value={o.value}
                checked={availability === o.value}
                onChange={() => setAvailability(o.value)}
                className="sr-only"
              />
              <span className="block text-[11px] font-bold text-slate-700">{o.title}</span>
              <span className="block text-[10px] text-slate-400">{o.hint}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── WHAT THE MONEY BUYS ──
          Investors see this on the pool page. The five parts must add up to
          the pool price, so the price is computed here rather than typed —
          a breakdown that does not reconcile is worse than none at all. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
        <span className={label}>Cost breakdown (optional)</span>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { key: "assetValue", label: "Asset value" },
            { key: "vat", label: "VAT" },
            { key: "serviceCharge", label: "Service charge" },
            { key: "maintenanceFee", label: "Maintenance fee" },
            { key: "companyCharge", label: "Company's charge" },
          ].map((f) => (
            <div key={f.key}>
              <label htmlFor={`pp-${f.key}`} className="mb-1 block text-[10px] font-bold text-slate-500">
                {f.label} (₦)
              </label>
              <NairaField
                id={`pp-${f.key}`}
                name={f.key}
                value={parts[f.key] ?? ""}
                onChange={(raw) => setParts({ ...parts, [f.key]: raw })}
                placeholder="0"
                className={input}
              />
            </div>
          ))}
          <div>
            <span className="mb-1 block text-[10px] font-bold text-slate-500">Total package</span>
            <p className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-extrabold tabular-nums text-slate-900">
              {fmtNaira(breakdownTotal)}
            </p>
          </div>
        </div>
        <FieldErr msg={state?.errors?.assetValue} />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          Leave these at zero to skip the breakdown. When filled in, the total becomes the pool
          price and investors see each line on the pool page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pp-target" className={label}>Pool price (₦)</label>
          {/* Driven by the breakdown when there is one, so the two can never
              disagree; typed directly when there is not. */}
          <NairaField
            id="pp-target"
            name="targetAmount"
            required
            placeholder="2,500,000"
            value={itemised ? String(breakdownTotal) : targetAmount}
            onChange={setTargetAmount}
            readOnly={itemised}
            className={`${input} ${itemised ? "bg-slate-100 text-slate-500" : ""}`}
          />
          <FieldErr msg={state?.errors?.targetAmount} />
        </div>
        <div>
          <label htmlFor="pp-min" className={label}>Min contribution (₦)</label>
          <NairaField
            id="pp-min"
            name="minContribution"
            required
            placeholder="50,000"
            value={minContribution}
            onChange={setMinContribution}
            className={input}
          />
          <FieldErr msg={state?.errors?.minContribution} />
        </div>
      </div>

      {availability !== "public" && (
        <div>
          <label htmlFor="pp-privmin" className={label}>
            Min contribution in a private pool (₦)
          </label>
          <NairaField
            id="pp-privmin"
            name="privateMinContribution"
            placeholder={`Leave blank for ${fmtNaira(PRIVATE_POOL_MINIMUM)}`}
            value={privateMin}
            onChange={setPrivateMin}
            className={input}
          />
          <FieldErr msg={state?.errors?.privateMinContribution} />
          <p className="mt-1 text-[10px] text-slate-400">
            A private pool is a few people filling one vehicle, so the slices are bigger. Blank
            uses the standard {fmtNaira(PRIVATE_POOL_MINIMUM)} floor.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pp-weeks" className={label}>Duration (weeks)</label>
          <input id="pp-weeks" name="durationWeeks" type="number" min={1} max={520} required placeholder="52" className={input} />
          <FieldErr msg={state?.errors?.durationWeeks} />
        </div>
        <div>
          <label htmlFor="pp-roi" className={label}>Total earnings (%)</label>
          <input id="pp-roi" name="roiPercent" type="number" min={0} max={1000} step="0.1" required placeholder="50" className={input} />
          <FieldErr msg={state?.errors?.roiPercent} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="py-3 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create pool option"}
      </button>
    </form>
  );
}
