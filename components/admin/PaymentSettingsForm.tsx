"use client";

import { useActionState, useState } from "react";
import { updatePaymentSettings } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import type { PaymentMethod, PaymentSettings } from "@/lib/settings";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

const OPTIONS: Array<{ value: PaymentMethod; title: string; blurb: string }> = [
  {
    value: "manual",
    title: "Bank transfer",
    blurb: "Users see your account details and tell you when they've sent money. You confirm each one.",
  },
  {
    value: "korapay",
    title: "Korapay",
    blurb: "Users pay by card or transfer on Korapay's checkout. Balances credit automatically.",
  },
];

export function PaymentSettingsForm({ settings }: { settings: PaymentSettings }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePaymentSettings,
    undefined
  );
  const [method, setMethod] = useState<PaymentMethod>(settings.method);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.message && (
        <p
          className={`text-xs rounded-xl px-3.5 py-2.5 border ${
            state.success
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {state.message}
        </p>
      )}

      <input type="hidden" name="method" value={method} />

      <div>
        <span className={label}>How users fund their account</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const active = method === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMethod(opt.value)}
                aria-pressed={active}
                className={`text-left p-4 rounded-2xl border transition-all duration-150 ${
                  active
                    ? "border-amber-400 bg-amber-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? "border-amber-400" : "border-slate-300"
                    }`}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">{opt.title}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{opt.blurb}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Only the selected method is shown to users. Switching takes effect immediately.
        </p>
      </div>

      <div
        className={`grid gap-4 sm:grid-cols-3 transition-opacity ${
          method === "manual" ? "opacity-100" : "opacity-50"
        }`}
      >
        <div className="sm:col-span-1">
          <label htmlFor="ps-number" className={label}>Account number</label>
          <input
            id="ps-number"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            maxLength={10}
            required
            defaultValue={settings.accountNumber}
            className={input}
          />
          <FieldErr msg={state?.errors?.accountNumber} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="ps-name" className={label}>Account name</label>
          <input
            id="ps-name"
            name="accountName"
            type="text"
            required
            defaultValue={settings.accountName}
            className={input}
          />
          <FieldErr msg={state?.errors?.accountName} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="ps-bank" className={label}>Bank</label>
          <input
            id="ps-bank"
            name="bankName"
            type="text"
            required
            defaultValue={settings.bankName}
            className={input}
          />
          <FieldErr msg={state?.errors?.bankName} />
        </div>
      </div>

      <div>
        <label htmlFor="ps-emails" className={label}>Notify these emails about transfers</label>
        <textarea
          id="ps-emails"
          name="notifyEmails"
          rows={2}
          required
          defaultValue={settings.notifyEmails.join(", ")}
          placeholder="info@rydvest.com, finance@rydvest.com"
          className={`${input} resize-y`}
        />
        <FieldErr msg={state?.errors?.notifyEmails} />
        <p className="text-[11px] text-slate-400 mt-1">
          Separate with commas. Everyone here gets a link to confirm each transfer.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="py-3 px-6 self-start bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
