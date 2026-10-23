"use client";

import { useState, useTransition } from "react";
import { revealKycNumber } from "@/app/actions/admin";

/**
 * Shows ·······1234 with a button that fetches the real number.
 *
 * The number is not sent to the browser with the page: it is decrypted on
 * request, and the request is written to the audit log. Hiding it again drops
 * it from memory, so leaving this screen open does not leave the number on it.
 */
export default function RevealNumber({
  submissionId,
  label,
  last4,
}: {
  submissionId: string;
  label: string;
  last4: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    setError(null);
    startTransition(async () => {
      const result = await revealKycNumber(submissionId);
      if (result.ok) setRevealed(result.idNumber);
      else setError(result.message);
    });
  }

  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
        {revealed ?? `${"·".repeat(7)}${last4}`}
      </dd>

      {error ? (
        <p className="mt-1 text-[11px] text-red-600 leading-snug">{error}</p>
      ) : revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(null)}
          className="mt-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Hide
        </button>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          className="mt-1 text-[11px] font-bold text-amber-600 hover:text-amber-500 transition-colors disabled:opacity-50"
        >
          {pending ? "Reading..." : "Reveal"}
        </button>
      )}
    </div>
  );
}
