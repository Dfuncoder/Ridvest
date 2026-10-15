"use client";

import { useActionState, useState } from "react";
import { lockUser, unlockUser, deleteUser } from "@/app/actions/admin";
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
 * Lock or unlock. A reason is required to lock, because the user is told an
 * account has been locked and somebody will eventually have to explain why.
 */
export function LockControls({ userId, locked }: { userId: string; locked: boolean }) {
  const [lockState, lockAction, locking] = useActionState<FormState, FormData>(lockUser, undefined);
  const [unlockState, unlockAction, unlocking] = useActionState<FormState, FormData>(
    unlockUser,
    undefined
  );
  const [open, setOpen] = useState(false);

  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <Banner state={unlockState} />
        <form action={unlockAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={unlocking}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-50"
          >
            {unlocking ? "Unlocking..." : "Unlock account"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Banner state={lockState} />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-extrabold text-sm rounded-xl transition-colors"
        >
          Lock account
        </button>
      ) : (
        <form action={lockAction} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input
            name="reason"
            type="text"
            maxLength={500}
            required
            autoFocus
            placeholder="Why? e.g. suspected fraud"
            className={input}
          />
          {lockState?.errors?.reason && (
            <p className="text-[11px] text-red-600">{lockState.errors.reason}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={locking}
              className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {locking ? "Locking..." : "Confirm lock"}
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

/**
 * Permanent deletion. Only offered for an account with no money records — the
 * server refuses otherwise — and the email has to be typed out, because this
 * is the one button here with nothing behind it.
 */
export function DeleteUserControls({
  userId,
  email,
  hasRecords,
}: {
  userId: string;
  email: string;
  hasRecords: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteUser, undefined);
  const [open, setOpen] = useState(false);

  if (hasRecords) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        This account has money records, so it cannot be deleted — removing it would break the
        ledger that explains where that money went. Lock it instead.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Banner state={state} />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-extrabold text-sm rounded-xl transition-colors"
        >
          Delete account
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={userId} />
          <p className="text-xs text-slate-600 leading-relaxed">
            This cannot be undone. Type <span className="font-bold text-slate-900">{email}</span> to
            confirm.
          </p>
          <input
            name="confirmEmail"
            type="text"
            autoComplete="off"
            required
            autoFocus
            placeholder={email}
            className={input}
          />
          {state?.errors?.confirmEmail && (
            <p className="text-[11px] text-red-600">{state.errors.confirmEmail}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {pending ? "Deleting..." : "Delete permanently"}
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
