"use client";

import { useActionState, useState } from "react";
import { confirmDeposit, rejectDeposit } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const fieldLabel =
  "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1";

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
 * Confirm / reject a declared bank transfer. The user never states an amount,
 * so the figure typed here — read off the bank account — is the only one that
 * ever reaches the balance.
 */
export function DepositActions({
  depositId,
  defaultDestination,
  defaultInitiator,
  size = "compact",
}: {
  depositId: string;
  /** The Rydvest account configured in settings. */
  defaultDestination: string;
  /** The depositor's profile name — overwrite if the bank shows another. */
  defaultInitiator: string;
  size?: "compact" | "full";
}) {
  const [confirmState, confirmAction, confirming] = useActionState<FormState, FormData>(
    confirmDeposit,
    undefined
  );
  const [rejectState, rejectAction, rejecting] = useActionState<FormState, FormData>(
    rejectDeposit,
    undefined
  );
  const [showReject, setShowReject] = useState(false);

  const busy = confirming || rejecting;
  const done = confirmState?.success || rejectState?.success;

  if (done) {
    const ok = Boolean(confirmState?.success);
    return (
      <div
        className={`rounded-xl px-4 py-3 border text-sm font-semibold ${
          ok
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}
      >
        {ok ? confirmState?.message : rejectState?.message}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${size === "full" ? "" : "min-w-60"}`}>
      <Banner state={confirmState} />
      <Banner state={rejectState} />

      {!showReject ? (
        <>
          <form action={confirmAction} className="flex flex-col gap-3">
            <input type="hidden" name="depositId" value={depositId} />
            <div>
              <label htmlFor={`amt-${depositId}`} className={fieldLabel}>
                Amount received
              </label>
              <input
                id={`amt-${depositId}`}
                name="actualAmount"
                type="number"
                min={1}
                step="0.01"
                required
                autoComplete="off"
                placeholder="0.00"
                className={input}
              />
              {confirmState?.errors?.actualAmount && (
                <p className="text-xs text-red-600 mt-1">{confirmState.errors.actualAmount}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Type exactly what landed in the Rydvest account.
              </p>
            </div>

            <div>
              <label htmlFor={`dest-${depositId}`} className={fieldLabel}>
                Destination account
              </label>
              <input
                id={`dest-${depositId}`}
                name="destinationAccount"
                type="text"
                maxLength={120}
                defaultValue={defaultDestination}
                className={input}
              />
            </div>

            <div>
              <label htmlFor={`init-${depositId}`} className={fieldLabel}>
                Initiated by
              </label>
              <input
                id={`init-${depositId}`}
                name="initiator"
                type="text"
                maxLength={120}
                defaultValue={defaultInitiator}
                className={input}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Change this if the bank shows a different sender.
              </p>
            </div>

            <div>
              <label htmlFor={`narr-${depositId}`} className={fieldLabel}>
                Narration
              </label>
              <input
                id={`narr-${depositId}`}
                name="narration"
                type="text"
                maxLength={200}
                required
                placeholder="As it appears on the bank alert"
                className={input}
              />
              {confirmState?.errors?.narration && (
                <p className="text-xs text-red-600 mt-1">{confirmState.errors.narration}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="py-2.5 px-4 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? "Crediting..." : "Money received — credit it"}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              These details go on the receipt emailed to the user.
            </p>
          </form>

          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={busy}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            I can&apos;t find this money
          </button>
        </>
      ) : (
        <form action={rejectAction} className="flex flex-col gap-2">
          <input type="hidden" name="depositId" value={depositId} />
          <div>
            <label htmlFor={`note-${depositId}`} className={fieldLabel}>
              Reason (sent to the user)
            </label>
            <input
              id={`note-${depositId}`}
              name="note"
              type="text"
              maxLength={500}
              placeholder="e.g. No matching transfer found"
              className={input}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-50"
            >
              {rejecting ? "Rejecting..." : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
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
