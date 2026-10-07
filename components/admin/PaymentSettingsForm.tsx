"use client";

import { useActionState, useEffect, useState } from "react";
import { updatePaymentSettings, resolveCompanyAccount } from "@/app/actions/admin";
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

export function PaymentSettingsForm({
  settings,
  banks,
}: {
  settings: PaymentSettings;
  banks: Array<{ name: string; code: string }>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePaymentSettings,
    undefined
  );
  const [method, setMethod] = useState<PaymentMethod>(settings.method);

  // Korapay resolves the account name from bank + number, exactly as on the
  // user-side withdrawal form. If the bank list is empty (no Korapay key) the
  // fields fall back to plain text so the settings stay editable.
  const lookupUnavailable = banks.length === 0;

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState(settings.accountNumber);
  const [typedBank, setTypedBank] = useState(settings.bankName);
  const [typedName, setTypedName] = useState(settings.accountName);

  // Tagged with the inputs it was for, so a stale reply never shows against a
  // newer number.
  const [result, setResult] = useState<{
    key: string;
    state: "ok" | "error";
    name?: string;
    message?: string;
  } | null>(null);

  const selectedBank = banks.find((b) => b.code === bankCode);
  const ready = Boolean(bankCode) && accountNumber.length === 10;
  const key = `${bankCode}:${accountNumber}`;

  useEffect(() => {
    if (lookupUnavailable || !ready) return;
    let current = true;
    const timer = setTimeout(async () => {
      const reply = await resolveCompanyAccount(bankCode, accountNumber);
      if (!current) return;
      if (reply.status === "ok") setResult({ key, state: "ok", name: reply.accountName });
      else setResult({ key, state: "error", message: reply.message });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [bankCode, accountNumber, key, ready, lookupUnavailable]);

  const lookup: { state: "idle" | "loading" | "ok" | "error"; name?: string; message?: string } =
    !ready ? { state: "idle" } : result?.key === key ? result : { state: "loading" };

  // What actually gets submitted for the two bank fields.
  const bankNameValue = lookupUnavailable ? typedBank : (selectedBank?.name ?? settings.bankName);
  const accountNameValue = lookupUnavailable
    ? typedName
    : lookup.state === "ok"
      ? (lookup.name ?? settings.accountName)
      : settings.accountName;

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
        className={`transition-opacity ${
          method === "manual" ? "opacity-100" : "opacity-50"
        }`}
      >
        <span className={label}>Account users transfer to</span>

        {lookupUnavailable ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ps-number" className={label}>Account number</label>
              <input
                id="ps-number"
                name="accountNumber"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className={`${input} tabular-nums`}
              />
              <FieldErr msg={state?.errors?.accountNumber} />
            </div>
            <div>
              <label htmlFor="ps-name" className={label}>Account name</label>
              <input
                id="ps-name"
                name="accountName"
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className={input}
              />
              <FieldErr msg={state?.errors?.accountName} />
            </div>
            <div>
              <label htmlFor="ps-bank" className={label}>Bank</label>
              <input
                id="ps-bank"
                name="bankName"
                type="text"
                value={typedBank}
                onChange={(e) => setTypedBank(e.target.value)}
                className={input}
              />
              <FieldErr msg={state?.errors?.bankName} />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="bankName" value={bankNameValue} />
            <input type="hidden" name="accountName" value={accountNameValue} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ps-bank" className={label}>Bank</label>
                <select
                  id="ps-bank"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className={input}
                >
                  <option value="">
                    {settings.bankName ? `Current: ${settings.bankName}` : "Choose the bank"}
                  </option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
                <FieldErr msg={state?.errors?.bankName} />
              </div>
              <div>
                <label htmlFor="ps-number" className={label}>Account number</label>
                <input
                  id="ps-number"
                  name="accountNumber"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={`${input} tabular-nums tracking-wider`}
                />
                <FieldErr msg={state?.errors?.accountNumber} />
              </div>
            </div>

            <div className="mt-3">
              <label className={label}>Account name</label>
              <div
                className={`${input} flex items-center gap-2 ${
                  lookup.state === "ok" ? "border-green-300 bg-green-50" : ""
                }`}
              >
                {lookup.state === "loading" && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-amber-400 animate-spin shrink-0" />
                )}
                <span
                  className={
                    lookup.state === "ok"
                      ? "font-bold text-green-900"
                      : lookup.state === "error"
                        ? "text-red-600"
                        : "text-slate-500"
                  }
                >
                  {lookup.state === "ok"
                    ? lookup.name
                    : lookup.state === "error"
                      ? lookup.message
                      : lookup.state === "loading"
                        ? "Checking with the bank..."
                        : settings.accountName || "Pick a bank and enter the number"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {lookup.state === "ok"
                  ? "Fetched from the bank — this is what users will see."
                  : "The name is fetched automatically once the bank and number are set."}
              </p>
            </div>
          </>
        )}
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
