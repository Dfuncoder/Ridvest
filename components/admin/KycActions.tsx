"use client";

import { useActionState, useState } from "react";
import { approveKyc, rejectKyc } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";

function Banner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`text-xs rounded-lg px-3 py-2 border ${
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
 * The decision. Approving needs one click, because the evidence is already on
 * screen; turning it down needs a reason, because the user is shown it and has
 * to know what to fix before trying again.
 */
export default function KycDecision({ submissionId }: { submissionId: string }) {
  const [approveState, approveAction, approving] = useActionState<FormState, FormData>(
    approveKyc,
    undefined
  );
  const [rejectState, rejectAction, rejecting] = useActionState<FormState, FormData>(
    rejectKyc,
    undefined
  );
  const [open, setOpen] = useState(false);
  const busy = approving || rejecting;

  return (
    <div className="flex flex-col gap-2">
      <Banner state={approveState} />
      <Banner state={rejectState} />

      {!open ? (
        <div className="flex gap-2">
          <form action={approveAction} className="flex-1">
            <input type="hidden" name="submissionId" value={submissionId} />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-50"
            >
              {approving ? "Approving..." : "Approve"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={busy}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-extrabold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <form action={rejectAction} className="flex flex-col gap-2">
          <input type="hidden" name="submissionId" value={submissionId} />
          <input
            name="reason"
            type="text"
            maxLength={500}
            required
            autoFocus
            placeholder="Why? e.g. the photo is too dark to make out"
            className={input}
          />
          {rejectState?.errors?.reason && (
            <p className="text-[11px] text-red-600">{rejectState.errors.reason}</p>
          )}
          <p className="text-[11px] text-slate-500">
            This is emailed to them word for word, so write it for them to read.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={rejecting}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {rejecting ? "Sending..." : "Confirm reject"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
