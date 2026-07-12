"use client";

/**
 * Admin form for creating a pool option (product): name (e.g. "Keke Napep"),
 * pool price, minimum contribution, duration and ROI %.
 */
import { useActionState } from "react";
import { createProduct } from "@/app/actions/admin";
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
          <label htmlFor="pp-months" className={label}>Duration (months)</label>
          <input id="pp-months" name="durationMonths" type="number" min={1} max={120} required placeholder="12" className={input} />
          <FieldErr msg={state?.errors?.durationMonths} />
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
