"use client";

import { useActionState, useEffect, useState } from "react";
import { startKorapayDeposit, declareManualTransfer } from "@/app/actions/wallet";
import type { FormState } from "@/app/actions/auth";
import { fmtNaira } from "@/lib/format";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";
const primaryBtn =
  "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed";

const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 500_000];

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function CopyRow({ labelText, value }: { labelText: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/10 last:border-0">
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">{labelText}</p>
        <p className="text-sm font-extrabold text-white truncate tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${labelText}`}
        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * The moment right after a user says they've sent a transfer. It confirms the
 * action, then gets out of the way — the transfer lives on in the history list
 * below, and sending another one is never blocked by it.
 */
function ProcessingCard({ onDone }: { onDone: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
      <div className="relative w-16 h-16 mx-auto mb-5">
        <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
        <span className="absolute inset-0 rounded-full border-2 border-amber-400/30" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-xl">🏦</span>
      </div>

      <h2 className="text-base font-extrabold text-slate-900 mb-1.5">Confirming your transfer</h2>
      <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
        Transfers usually take a few minutes. Your balance updates automatically — you don&apos;t
        need to wait here. If nothing has changed after 30 minutes, contact us.
      </p>

      <div className="flex items-center justify-center gap-2 mt-5 mb-6">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
      >
        Send another transfer
      </button>
    </div>
  );
}

function AmountField({ error }: { error?: string }) {
  const [amount, setAmount] = useState("");

  return (
    <div>
      <label htmlFor="fund-amount" className={label}>Amount to add</label>
      <input
        id="fund-amount"
        name="amount"
        type="number"
        inputMode="numeric"
        min={100}
        step={1}
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g. 50000"
        className={input}
      />
      <FieldErr msg={error} />
      <div className="flex flex-wrap gap-2 mt-2.5">
        {QUICK_AMOUNTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-400 hover:text-slate-900 transition-colors"
          >
            {fmtNaira(q)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Gate in front of the account details. The name-match rule is the only thing
 * tying an incoming transfer to a user, so it is stated before the user can
 * see where to send money — not buried in fine print afterwards.
 */
function NameMatchDialog({
  profileName,
  onAccept,
  onClose,
}: {
  profileName: string;
  onAccept: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#0d2137]/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="namematch-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl p-7 shadow-2xl animate-[popIn_180ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="w-14 h-14 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>

        <h2 id="namematch-title" className="text-lg font-extrabold text-slate-900 text-center mb-3">
          Send from your own account
        </h2>

        <p className="text-sm text-slate-500 leading-relaxed text-center mb-4">
          The bank account you transfer from must be in the name
        </p>

        <p className="text-base font-extrabold text-slate-900 text-center bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mb-4 break-words">
          {profileName || "your profile name"}
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-6">
          <p className="text-xs text-amber-900 leading-relaxed">
            A transfer from an account in a different name will not be credited.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button type="button" onClick={onAccept} className={`flex-1 py-3 ${primaryBtn}`}>
            I understand
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL TRANSFER — warn about the name-match rule, show the company account,
// then let the user tell us they have sent the money. No amount is asked for;
// an admin reads the real figure off the bank account.
// ─────────────────────────────────────────────────────────────────────────────
export function ManualTransferPanel({
  bankName,
  accountName,
  accountNumber,
  profileName,
}: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  profileName: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    declareManualTransfer,
    undefined
  );
  const [revealed, setRevealed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);

  // A fresh success shows the confirmation card once; dismissing it returns to
  // the form so another transfer is always one click away.
  const showProcessing = Boolean(state?.success) && !justSent;

  if (showProcessing) {
    return (
      <ProcessingCard
        onDone={() => {
          setJustSent(true);
          setRevealed(true);
        }}
      />
    );
  }

  if (!revealed) {
    return (
      <>
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-extrabold text-slate-900 mb-1">Fund your account</h2>
            <p className="text-sm text-slate-500 mb-5">
              Send a bank transfer to Rydvest and we&apos;ll credit your balance once it lands.
            </p>
            <button onClick={() => setDialogOpen(true)} className={`w-full py-3.5 ${primaryBtn}`}>
              Fund account
            </button>
          </div>
        </div>

        {dialogOpen && (
          <NameMatchDialog
            profileName={profileName}
            onClose={() => setDialogOpen(false)}
            onAccept={() => {
              setDialogOpen(false);
              setRevealed(true);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#0d2137] rounded-2xl p-6 shadow-xl shadow-[#0d2137]/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            Transfer to this account
          </p>
        </div>
        <div className="mt-3">
          <CopyRow labelText="Account number" value={accountNumber} />
          <CopyRow labelText="Account name" value={accountName} />
          <CopyRow labelText="Bank" value={bankName} />
        </div>
      </div>

      <form action={formAction} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
        {state?.message && !state.success && (
          <p className="text-xs rounded-xl px-3.5 py-2.5 border text-red-600 bg-red-50 border-red-200">
            {state.message}
          </p>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <p className="text-xs text-amber-900 leading-relaxed">
            Send from your <span className="font-bold">{profileName || "own"}</span> account, then
            press the button below.
          </p>
        </div>

        <button type="submit" disabled={pending} className={`py-3.5 ${primaryBtn}`}>
          {pending ? "Submitting..." : "I've sent the money"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KORAPAY — straight to hosted checkout.
// ─────────────────────────────────────────────────────────────────────────────
export function KorapayPanel() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    startKorapayDeposit,
    undefined
  );

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-extrabold text-slate-900 mb-1">Fund your account</h2>
        <p className="text-sm text-slate-500">
          Pay by card or bank transfer. Your balance is credited automatically.
        </p>
      </div>

      {state?.message && !state.success && (
        <p className="text-xs rounded-xl px-3.5 py-2.5 border text-red-600 bg-red-50 border-red-200">
          {state.message}
        </p>
      )}

      <AmountField error={state?.errors?.amount} />

      <button type="submit" disabled={pending} className={`py-3.5 ${primaryBtn}`}>
        {pending ? "Opening secure checkout..." : "Continue to payment"}
      </button>
      <p className="text-[11px] text-slate-400 text-center">
        Payments are processed securely by Korapay.
      </p>
    </form>
  );
}
