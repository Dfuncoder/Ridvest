"use client";

/**
 * Refunds one person out of a pool that is still filling.
 *
 * Two clicks and a reason, because this moves real money and the record of
 * WHY is the thing anyone will want six months later. Nothing here decides
 * anything — refund_investment() in SQL does the deciding, under a lock, and
 * this just shows what it said.
 */
import { useActionState, useState } from "react";
import { refundInvestment } from "@/app/actions/admin";
import { fmtNaira } from "@/lib/format";
import type { FormState } from "@/app/actions/auth";

export default function RefundControls({
  investmentId,
  amount,
  investorName,
}: {
  investmentId: string;
  amount: number;
  investorName: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    refundInvestment,
    undefined
  );
  const [open, setOpen] = useState(false);

  if (state?.success) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-700">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        {state?.message && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600">
            {state.message}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          Refund
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="investmentId" value={investmentId} />

      <p className="text-[11px] leading-relaxed text-slate-600">
        Return <span className="font-bold text-slate-900">{fmtNaira(amount)}</span> to{" "}
        <span className="font-bold text-slate-900">{investorName}</span>&apos;s Rydvest balance.
        The pool stays open and nobody else is affected.
      </p>

      <input
        name="reason"
        type="text"
        maxLength={500}
        required
        autoFocus
        placeholder="Why? e.g. asked support to leave the pool"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-400"
      />
      {state?.errors?.reason && (
        <p className="text-[11px] text-red-600">{state.errors.reason}</p>
      )}
      {state?.message && <p className="text-[11px] text-red-600">{state.message}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Refunding..." : "Confirm refund"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
