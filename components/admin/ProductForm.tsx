"use client";

/**
 * Admin form for creating a pool option (product): name (e.g. "Keke Napep"),
 * pool price, minimum contribution, duration and ROI %.
 */
import { useActionState, useState } from "react";
import Image from "next/image";
import { createProduct } from "@/app/actions/admin";
import { VEHICLES } from "@/lib/vehicles";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

export default function ProductForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProduct, undefined);
  const [picked, setPicked] = useState("");

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
        <input id="pp-desc" name="description" type="text" maxLength={500} placeholder="Short description shown to investors" className={input} />
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pp-target" className={label}>Pool price (₦)</label>
          <input id="pp-target" name="targetAmount" type="number" min={1} step="0.01" required placeholder="2500000" className={input} />
          <FieldErr msg={state?.errors?.targetAmount} />
        </div>
        <div>
          <label htmlFor="pp-min" className={label}>Min contribution (₦)</label>
          <input id="pp-min" name="minContribution" type="number" min={1} step="0.01" required placeholder="50000" className={input} />
          <FieldErr msg={state?.errors?.minContribution} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pp-weeks" className={label}>Duration (weeks)</label>
          <input id="pp-weeks" name="durationWeeks" type="number" min={1} max={520} required placeholder="52" className={input} />
          <FieldErr msg={state?.errors?.durationWeeks} />
        </div>
        <div>
          <label htmlFor="pp-roi" className={label}>Total ROI (%)</label>
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
