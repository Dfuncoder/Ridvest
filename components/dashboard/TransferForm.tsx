"use client";

/**
 * SEND TO ANOTHER ACCOUNT — two steps on purpose.
 *
 * Step 1 is the account ID alone. Nothing about the amount appears until the
 * ID has resolved to a real name, so the sender reads who they are paying
 * before they think about how much. Step 2 shows that name above the amount
 * and posts it back with the form; the server re-resolves the ID and refuses
 * if the name no longer matches.
 *
 * Transfers are final. That is stated plainly rather than buried, because it
 * is the one thing somebody would want to know before pressing the button.
 *
 * The lookup result is stored against the ID it was fetched for, and what the
 * form shows is derived from that. Keeping them together means a result can
 * never be shown beside a different ID — and nothing has to be reset in an
 * effect when the ID changes.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { lookupUserCode, sendTransfer } from "@/app/actions/transfer";
import { MoneyInput } from "./MoneyInput";
import { ERRORS } from "@/lib/errors";
import { fmtNaira } from "@/lib/format";
import { TRANSFER_LIMITS } from "@/lib/economics";
import { normaliseUserCode } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "block text-xs font-bold text-slate-700 mb-1.5";

/** Length of a full account ID: "RYD" plus six characters. */
const CODE_LENGTH = 9;

type Lookup =
  | { kind: "loading" }
  | { kind: "ok"; code: string; name: string }
  | { kind: "error"; message: string };

export default function TransferForm({ balance }: { balance: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendTransfer,
    undefined
  );

  const [code, setCode] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [result, setResult] = useState<{ forCode: string; value: Lookup } | null>(null);

  // Guards against an older, slower lookup landing after a newer one and
  // overwriting the name on screen with a stale answer.
  const requestRef = useRef(0);

  const normalised = normaliseUserCode(code);
  const complete = normalised.length === CODE_LENGTH;

  // Derived, not stored: an incomplete ID has no lookup, and a result for a
  // different ID does not count.
  const lookup: Lookup | null = !complete
    ? null
    : result?.forCode === normalised
      ? result.value
      : { kind: "loading" };

  useEffect(() => {
    if (!complete) return;

    const id = ++requestRef.current;
    let cancelled = false;

    // A short pause so a fast typist does not spend their lookup allowance on
    // half-finished IDs.
    const timer = setTimeout(async () => {
      const found = await lookupUserCode(normalised);
      if (cancelled || id !== requestRef.current) return;
      setResult({
        forCode: normalised,
        value: found.ok
          ? { kind: "ok", code: found.code, name: found.name }
          : { kind: "error", message: found.message },
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalised, complete]);

  function startOver() {
    setCode("");
    setAmount(null);
    setResult(null);
    requestRef.current += 1;
  }

  // ── Done ──
  // Replacing the form rather than clearing it: the confirmation stays put
  // until the sender chooses to send again, and there is no state to reset
  // behind their back.
  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
          <div className="mb-1.5 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.4}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <p className="text-sm font-extrabold text-green-900">Sent</p>
          </div>
          <p className="text-sm leading-relaxed text-green-800">{state.message}</p>
        </div>
        <button
          type="button"
          onClick={startOver}
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          Send to someone else
        </button>
      </div>
    );
  }

  const resolved = lookup?.kind === "ok" ? lookup : null;
  const canSend =
    resolved !== null && amount !== null && amount > 0 && amount <= balance && !pending;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.message && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
          {state.message}
        </p>
      )}

      {/* ── 1. WHO ── */}
      <div>
        <label htmlFor="trf-code" className={label}>
          Their account ID
        </label>
        <input
          id="trf-code"
          name="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="RYD4K7M2P"
          className={`${input} font-mono uppercase tracking-[0.12em]`}
        />

        {lookup?.kind === "loading" && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-amber-400" />
            Checking
          </p>
        )}
        {lookup?.kind === "error" && (
          <p className="mt-1.5 text-[11px] text-red-600">{lookup.message}</p>
        )}
        {!complete && (
          <p className="mt-1.5 text-[11px] text-slate-400">Nine characters, starting with RYD.</p>
        )}
        {state?.errors?.code && (
          <p className="mt-1.5 text-[11px] text-red-600">{state.errors.code}</p>
        )}
      </div>

      {/* ── 2. CONFIRM WHO, THEN HOW MUCH ── */}
      {resolved && (
        <>
          {/* Posted back so the server can check the sender agreed to this
              person, not merely to this ID. */}
          <input type="hidden" name="confirmedName" value={resolved.name} />

          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green-700/70">
              Sending to
            </p>
            <p className="text-base font-extrabold text-green-900">{resolved.name}</p>
            <p className="font-mono text-[11px] text-green-700/80">{resolved.code}</p>
          </div>

          <div>
            <label htmlFor="trf-amount" className={label}>
              Amount (you have {fmtNaira(balance)})
            </label>
            <MoneyInput
              id="trf-amount"
              name="amount"
              value={amount}
              onChange={setAmount}
              min={TRANSFER_LIMITS.minAmount}
              max={Math.min(balance, TRANSFER_LIMITS.maxAmount)}
              required
              placeholder={`From ${fmtNaira(TRANSFER_LIMITS.minAmount)}`}
              className={`${input} tabular-nums`}
            />
            {state?.errors?.amount && (
              <p className="mt-1.5 text-[11px] text-red-600">{state.errors.amount}</p>
            )}
          </div>

          <div>
            <label htmlFor="trf-note" className={label}>
              Note (optional)
            </label>
            <input
              id="trf-note"
              name="note"
              type="text"
              maxLength={140}
              placeholder="What it's for"
              className={input}
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-amber-800">
              <span className="font-bold">Transfers cannot be reversed.</span> Make sure the name
              above is the person you mean to pay.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSend}
            className="rounded-xl bg-[#0d2137] px-4 py-3.5 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#14314f] active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {pending
              ? "Sending..."
              : amount
                ? `Send ${fmtNaira(amount)} to ${resolved.name.split(/\s+/)[0]}`
                : "Send"}
          </button>
        </>
      )}

      {!resolved && balance <= 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
          {ERRORS.INSUFFICIENT_BALANCE}
        </p>
      )}
    </form>
  );
}
