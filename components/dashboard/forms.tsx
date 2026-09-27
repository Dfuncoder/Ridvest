"use client";

/**
 * Interactive client forms used inside the (server-rendered) dashboard pages.
 * Every form submits to a server action, which re-validates everything —
 * these components are presentation + optimistic UX only.
 */
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { joinPool, createPool, joinByInvite } from "@/app/actions/invest";
import { addWithdrawalAccount, requestWithdrawal, lookupBankAccount } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { MoneyInput } from "./MoneyInput";
import { fmtNaira } from "@/lib/format";

// Light-card styling shared by these forms.
const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";
const primaryBtn =
  "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed";

function Banner({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p className={`text-xs rounded-xl px-3.5 py-2.5 mb-3 border ${
      state.success
        ? "text-green-700 bg-green-50 border-green-200"
        : "text-red-600 bg-red-50 border-red-200"
    }`}>
      {state.message}
    </p>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// JOIN A POOL — spends the Rydvest balance, no payment redirect.
// ─────────────────────────────────────────────────────────────────────────────
export function InvestForm({
  poolId,
  minContribution,
  remaining,
  balance,
}: {
  poolId: string;
  minContribution: number;
  remaining: number;
  balance: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(joinPool, undefined);
  const [amount, setAmount] = useState<number | null>(null);

  const minimum = Math.min(minContribution, remaining);

  if (balance < minimum) {
    return (
      <div className="mt-3">
        <Banner state={state} />
        <Link
          href="/dashboard/deposit"
          className={`block text-center px-5 py-2.5 ${primaryBtn}`}
        >
          Add money to invest
        </Link>
        <p className="text-[11px] text-slate-400 mt-1.5">
          You have {fmtNaira(balance)}. This pool needs at least {fmtNaira(minimum)}.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3">
      <Banner state={state} />
      <input type="hidden" name="poolId" value={poolId} />
      <div className="flex gap-2">
        <div className="flex-1">
          <MoneyInput
            id="inv-amount"
            name="amount"
            value={amount}
            onChange={setAmount}
            min={minimum}
            max={Math.min(remaining, balance)}
            required
            placeholder={`Min ${fmtNaira(minimum)}`}
            className={`${input} tabular-nums`}
          />
        </div>
        <button type="submit" disabled={pending} className={`px-5 py-2.5 ${primaryBtn}`}>
          {pending ? "Joining..." : "Invest"}
        </button>
      </div>
      <FieldErr msg={state?.errors?.amount} />
      <p className="text-[11px] text-slate-400 mt-1.5">
        {fmtNaira(remaining)} left to fill this pool.
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE A NEW POOL (e.g. a private one to fill with friends)
// ─────────────────────────────────────────────────────────────────────────────
export function CreatePoolForm({
  products,
}: {
  products: Array<{ id: string; name: string; target_amount: number }>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPool, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div>
        <label htmlFor="new-pool-product" className={label}>Investment option</label>
        <select id="new-pool-product" name="productId" required defaultValue="" className={input}>
          <option value="" disabled>Choose an option</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {fmtNaira(p.target_amount)}
            </option>
          ))}
        </select>
        <FieldErr msg={state?.errors?.productId} />
      </div>
      <div>
        <label htmlFor="new-pool-name" className={label}>Pool name</label>
        <input id="new-pool-name" name="name" type="text" required minLength={3} maxLength={80} placeholder="e.g. Jude & friends" className={input} />
        <FieldErr msg={state?.errors?.name} />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" name="isPrivate" value="true" className="w-4 h-4 accent-amber-400" />
        <span className="text-xs text-slate-500">
          Private pool — only people with the invite code can join
        </span>
      </label>
      <button type="submit" disabled={pending} className={`py-3 ${primaryBtn}`}>
        {pending ? "Creating..." : "Create pool →"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOIN A PRIVATE POOL BY INVITE CODE
// ─────────────────────────────────────────────────────────────────────────────
export function JoinByInviteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(joinByInvite, undefined);

  return (
    <form action={formAction}>
      <Banner state={state} />
      <div className="flex gap-2">
        <input
          type="text"
          name="inviteCode"
          maxLength={8}
          required
          placeholder="8-character invite code"
          className={`${input} uppercase tracking-widest`}
        />
        <button type="submit" disabled={pending} className={`px-5 py-2.5 ${primaryBtn}`}>
          {pending ? "..." : "Join"}
        </button>
      </div>
      <FieldErr msg={state?.errors?.inviteCode} />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD WITHDRAWAL BANK ACCOUNT
//
// The user picks a bank and types an account number; the name is fetched from
// the bank and shown read-only. Nothing can be saved until a name comes back
// and matches the profile, and the server resolves it again on submit.
// ─────────────────────────────────────────────────────────────────────────────
export function AddAccountForm({
  profileName,
  banks,
}: {
  profileName: string;
  banks: Array<{ name: string; code: string }>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addWithdrawalAccount,
    undefined
  );

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // The reply is tagged with the bank + number it was for, so a result for an
  // old number is never shown against a new one.
  const [result, setResult] = useState<{
    key: string;
    state: "ok" | "error";
    name?: string;
    message?: string;
  } | null>(null);

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const lookupUnavailable = banks.length === 0;
  const ready = Boolean(bankCode) && accountNumber.length === 10;
  const key = `${bankCode}:${accountNumber}`;

  // Ask the bank once we have a bank and ten digits. The state is only ever set
  // from inside the timer callback, never synchronously while the effect runs.
  useEffect(() => {
    if (lookupUnavailable || !ready) return;

    let current = true;
    const timer = setTimeout(async () => {
      const reply = await lookupBankAccount(bankCode, accountNumber);
      if (!current) return;
      if (reply.status === "ok") setResult({ key, state: "ok", name: reply.accountName });
      else setResult({ key, state: "error", message: reply.message });
    }, 400);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [bankCode, accountNumber, key, ready, lookupUnavailable]);

  // Derived, so nothing stale can linger: no inputs yet means idle, inputs
  // without a matching reply means still loading.
  const lookup: { state: "idle" | "loading" | "ok" | "error"; name?: string; message?: string } =
    !ready ? { state: "idle" } : result?.key === key ? result : { state: "loading" };
  const canSubmit = lookupUnavailable ? Boolean(bankCode || bankName) : lookup.state === "ok";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <input type="hidden" name="bankCode" value={bankCode} />
      <input type="hidden" name="bankName" value={bankName} />

      {lookupUnavailable ? (
        <div>
          <label htmlFor="wa-bank" className={label}>Bank name</label>
          <input id="wa-bank" name="bankName" type="text" required placeholder="e.g. First Bank of Nigeria" className={input} />
          <FieldErr msg={state?.errors?.bankName} />
        </div>
      ) : (
        <div>
          <label htmlFor="wa-bank" className={label}>Bank</label>
          <select
            id="wa-bank"
            required
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            className={input}
          >
            <option value="" disabled>Choose your bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
          <FieldErr msg={state?.errors?.bankName} />
        </div>
      )}

      <div>
        <label htmlFor="wa-number" className={label}>Account number</label>
        <input
          id="wa-number"
          name="accountNumber"
          type="text"
          inputMode="numeric"
          maxLength={10}
          required
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit account number"
          className={`${input} tabular-nums tracking-wider`}
        />
        <FieldErr msg={state?.errors?.accountNumber} />
      </div>

      <div>
        <label htmlFor="wa-name" className={label}>Account name</label>
        <input
          id="wa-name"
          name="accountName"
          type="text"
          readOnly={!lookupUnavailable}
          required={lookupUnavailable}
          value={lookupUnavailable ? undefined : lookup.name ?? ""}
          defaultValue={lookupUnavailable ? "" : undefined}
          placeholder={
            lookupUnavailable
              ? profileName
              : lookup.state === "loading"
                ? "Checking with your bank..."
                : "Appears once your account is found"
          }
          className={`${input} ${lookupUnavailable ? "" : "font-bold cursor-default"} ${
            lookup.state === "ok" ? "border-green-300 bg-green-50 text-green-900" : ""
          }`}
        />
        <FieldErr msg={state?.errors?.accountName} />

        {lookup.state === "loading" && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-amber-400 animate-spin" />
            Checking with your bank
          </p>
        )}
        {lookup.state === "error" && (
          <p className="text-[11px] text-red-600 mt-1.5">{lookup.message}</p>
        )}
        {lookup.state === "idle" && !lookupUnavailable && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Pick your bank and enter the account number — we&apos;ll fetch the name.
          </p>
        )}
        {lookupUnavailable && (
          <p className="text-[11px] text-slate-400 mt-1.5">
            Must match your profile name (<span className="font-semibold">{profileName}</span>).
          </p>
        )}
      </div>

      <button type="submit" disabled={pending || !canSubmit} className={`py-3 ${primaryBtn}`}>
        {pending ? "Saving..." : "Add bank account"}
      </button>
    </form>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// REQUEST A WITHDRAWAL
// ─────────────────────────────────────────────────────────────────────────────
export function WithdrawForm({
  accounts,
  balance,
}: {
  accounts: Array<{ id: string; bank_name: string; account_number: string; account_name: string }>;
  balance: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestWithdrawal, undefined);
  const [amount, setAmount] = useState<number | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        Add a withdrawal bank account in{" "}
        <a href="/dashboard/profile" className="text-amber-500 font-semibold">Profile</a>{" "}
        before requesting a withdrawal.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div>
        <label htmlFor="wd-account" className={label}>Pay to</label>
        <select id="wd-account" name="accountId" required defaultValue={accounts[0].id} className={input}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bank_name} — {a.account_number} ({a.account_name})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="wd-amount" className={label}>Amount (available: {fmtNaira(balance)})</label>
        <MoneyInput
          id="wd-amount"
          name="amount"
          value={amount}
          onChange={setAmount}
          min={1}
          max={balance}
          required
          placeholder="Amount to withdraw"
          className={`${input} tabular-nums`}
        />
        <FieldErr msg={state?.errors?.amount} />
      </div>
      <button type="submit" disabled={pending || balance <= 0} className={`py-3 ${primaryBtn}`}>
        {pending ? "Submitting..." : "Request withdrawal"}
      </button>
    </form>
  );
}
