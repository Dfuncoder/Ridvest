"use client";

import { useActionState, useState } from "react";
import { settleDuePayouts, revertPayout, restorePayout } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

function Banner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`text-xs rounded-xl px-3.5 py-2.5 border ${
        state.success
          ? "text-green-700 bg-green-50 border-green-200"
          : "text-red-600 bg-red-50 border-red-200"
      }`}
    >
      {state.message}
    </p>
  );
}

/**
 * Runs the settlement by hand. Normally the schedule does this; the button is
 * for when something was due and you do not want to wait for the next run.
 * Settling is idempotent, so pressing it twice is harmless.
 */
export function SettleNowButton({ dueCount }: { dueCount: number }) {
  const [state, action, pending] = useActionState<FormState>(settleDuePayouts, undefined);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending || dueCount === 0}
        className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {pending ? "Settling..." : dueCount === 0 ? "Nothing due" : `Settle ${dueCount} now`}
      </button>
      <div className="max-w-xs">
        <Banner state={state} />
      </div>
    </form>
  );
}

/**
 * Takes a credited payout back off the balance. A reason is required because
 * this is the one action here that removes money a user has already been told
 * is theirs.
 */
export function RevertPayoutButton({ payoutId }: { payoutId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(revertPayout, undefined);
  const [open, setOpen] = useState(false);

  if (state?.success) {
    return <p className="text-[11px] font-semibold text-slate-500">{state.message}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors whitespace-nowrap"
      >
        Revert
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 min-w-56">
      <Banner state={state} />
      <input type="hidden" name="payoutId" value={payoutId} />
      <input
        name="reason"
        type="text"
        maxLength={500}
        required
        autoFocus
        placeholder="Why? e.g. duplicate, fraudulent"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-400"
      />
      {state?.errors?.reason && <p className="text-[11px] text-red-600">{state.errors.reason}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
        >
          {pending ? "Reverting..." : "Confirm revert"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RestorePayoutButton({ payoutId }: { payoutId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(restorePayout, undefined);

  if (state?.success) {
    return <p className="text-[11px] font-semibold text-slate-500">{state.message}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="payoutId" value={payoutId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {pending ? "Restoring..." : "Put back in queue"}
      </button>
    </form>
  );
}
