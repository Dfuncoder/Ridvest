"use client";

/**
 * Setting, changing and resetting the transaction PIN.
 *
 * Three states in one card because they are the same decision from the user's
 * side — "I need to deal with my PIN" — and splitting them across pages would
 * mean someone who has forgotten theirs has to go hunting.
 */
import { useActionState, useState } from "react";
import { setTransactionPin, resetTransactionPin } from "@/app/actions/pin";
import PinInput from "./PinInput";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";

function Banner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p
      className={`rounded-xl border px-3.5 py-2.5 text-xs ${
        state.success
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-600"
      }`}
    >
      {state.message}
    </p>
  );
}

export default function PinSetup({ hasPin }: { hasPin: boolean }) {
  const [setState, setAction, setting] = useActionState<FormState, FormData>(
    setTransactionPin,
    undefined
  );
  const [resetState, resetAction, resetting] = useActionState<FormState, FormData>(
    resetTransactionPin,
    undefined
  );

  const [open, setOpen] = useState(!hasPin);
  const [forgot, setForgot] = useState(false);

  // ── Already set, and not being changed ───────────────────────────────────
  if (hasPin && !open) {
    return (
      <div className="flex flex-col gap-3">
        <Banner state={setState} />
        <Banner state={resetState} />
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5">
          <svg
            className="h-5 w-5 shrink-0 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <p className="text-sm font-bold text-green-900">Your PIN is set</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setForgot(false);
          }}
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          Change my PIN
        </button>
      </div>
    );
  }

  // ── Forgotten: prove it is them with the account password ────────────────
  if (hasPin && forgot) {
    return (
      <form action={resetAction} className="flex flex-col gap-4">
        <Banner state={resetState} />
        <p className="text-xs leading-relaxed text-slate-500">
          Enter your account password and choose a new PIN.
        </p>

        <div>
          <label htmlFor="pin-password" className="mb-1.5 block text-xs font-bold text-slate-700">
            Account password
          </label>
          <input
            id="pin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={input}
          />
          {resetState?.errors?.password && (
            <p className="mt-1.5 text-[11px] text-red-600">{resetState.errors.password}</p>
          )}
        </div>

        <PinInput name="pin" label="New PIN" error={resetState?.errors?.pin} />
        <PinInput name="confirmPin" label="Confirm new PIN" error={resetState?.errors?.confirmPin} />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={resetting}
            className="flex-1 rounded-xl bg-[#0d2137] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#14314f] disabled:opacity-50"
          >
            {resetting ? "Saving..." : "Reset PIN"}
          </button>
          <button
            type="button"
            onClick={() => setForgot(false)}
            className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Back
          </button>
        </div>
      </form>
    );
  }

  // ── First time, or changing with the current PIN ─────────────────────────
  return (
    <form action={setAction} className="flex flex-col gap-4">
      <Banner state={setState} />

      {!hasPin && (
        <p className="text-xs leading-relaxed text-slate-500">
          You&apos;ll enter this PIN every time you withdraw, join a pool or send money. Don&apos;t
          use your date of birth, and don&apos;t share it with anyone.
        </p>
      )}

      {hasPin && (
        <PinInput name="currentPin" label="Current PIN" error={setState?.errors?.currentPin} />
      )}

      <PinInput
        name="pin"
        label={hasPin ? "New PIN" : "Choose a 4-digit PIN"}
        autoFocus={!hasPin}
        error={setState?.errors?.pin}
      />
      <PinInput
        name="confirmPin"
        label={hasPin ? "Confirm new PIN" : "Enter it again"}
        error={setState?.errors?.confirmPin}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={setting}
          className="flex-1 rounded-xl bg-[#0d2137] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#14314f] disabled:opacity-50"
        >
          {setting ? "Saving..." : hasPin ? "Change PIN" : "Set my PIN"}
        </button>

        {hasPin && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setForgot(true)}
              className="w-full text-left text-[11px] font-bold text-amber-600 transition-colors hover:text-amber-500"
            >
              I&apos;ve forgotten my PIN
            </button>
          </>
        )}
      </div>
    </form>
  );
}
