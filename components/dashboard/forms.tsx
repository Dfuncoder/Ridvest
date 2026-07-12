"use client";

/**
 * Interactive client forms used inside the (server-rendered) dashboard pages.
 * Every form submits to a server action, which re-validates everything —
 * these components are presentation + optimistic UX only.
 */
import { useActionState } from "react";
import { startInvestment, createPool, joinByInvite } from "@/app/actions/invest";
import { updateProfile, addWithdrawalAccount, requestWithdrawal } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { NIGERIAN_STATES } from "@/lib/validation";
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
// INVEST IN A POOL — amount input + pay button (redirects to Paystack).
// ─────────────────────────────────────────────────────────────────────────────
export function InvestForm({
  poolId,
  minContribution,
  remaining,
}: {
  poolId: string;
  minContribution: number;
  remaining: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startInvestment, undefined);

  return (
    <form action={formAction} className="mt-3">
      <Banner state={state} />
      <input type="hidden" name="poolId" value={poolId} />
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            name="amount"
            min={Math.min(minContribution, remaining)}
            max={remaining}
            step={1}
            required
            placeholder={`Min ${fmtNaira(Math.min(minContribution, remaining))}`}
            className={input}
          />
        </div>
        <button type="submit" disabled={pending} className={`px-5 py-2.5 ${primaryBtn}`}>
          {pending ? "Starting..." : "Invest"}
        </button>
      </div>
      <FieldErr msg={state?.errors?.amount} />
      <p className="text-[11px] text-slate-400 mt-1.5">
        You'll pay securely via Paystack. {fmtNaira(remaining)} left to fill this pool.
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
// EDIT PROFILE
// ─────────────────────────────────────────────────────────────────────────────
export function ProfileForm({
  profile,
}: {
  profile: { full_name: string; phone: string; address: string; state_of_residence: string };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div>
        <label htmlFor="pf-name" className={label}>Full name</label>
        <input id="pf-name" name="fullName" type="text" required defaultValue={profile.full_name} className={input} />
        <FieldErr msg={state?.errors?.fullName} />
        <p className="text-[11px] text-slate-400 mt-1">
          ⚠ Your withdrawal bank account must be in exactly this name.
        </p>
      </div>
      <div>
        <label htmlFor="pf-phone" className={label}>Phone number</label>
        <input id="pf-phone" name="phone" type="tel" required defaultValue={profile.phone} className={input} />
        <FieldErr msg={state?.errors?.phone} />
      </div>
      <div>
        <label htmlFor="pf-address" className={label}>Home address</label>
        <input id="pf-address" name="address" type="text" required defaultValue={profile.address} className={input} />
        <FieldErr msg={state?.errors?.address} />
      </div>
      <div>
        <label htmlFor="pf-state" className={label}>State of residence</label>
        <select id="pf-state" name="state" required defaultValue={profile.state_of_residence} className={input}>
          {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <FieldErr msg={state?.errors?.state} />
      </div>
      <button type="submit" disabled={pending} className={`py-3 ${primaryBtn}`}>
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD WITHDRAWAL BANK ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────
export function AddAccountForm({ profileName }: { profileName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addWithdrawalAccount, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div>
        <label htmlFor="wa-bank" className={label}>Bank name</label>
        <input id="wa-bank" name="bankName" type="text" required placeholder="e.g. First Bank of Nigeria" className={input} />
        <FieldErr msg={state?.errors?.bankName} />
      </div>
      <div>
        <label htmlFor="wa-number" className={label}>Account number</label>
        <input id="wa-number" name="accountNumber" type="text" inputMode="numeric" maxLength={10} required placeholder="10-digit account number" className={input} />
        <FieldErr msg={state?.errors?.accountNumber} />
      </div>
      <div>
        <label htmlFor="wa-name" className={label}>Account holder name</label>
        <input id="wa-name" name="accountName" type="text" required placeholder={profileName} className={input} />
        <FieldErr msg={state?.errors?.accountName} />
        <p className="text-[11px] text-slate-400 mt-1">
          Must match your profile name (<span className="font-semibold">{profileName}</span>) or withdrawals will be rejected.
        </p>
      </div>
      <button type="submit" disabled={pending} className={`py-3 ${primaryBtn}`}>
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
        <input id="wd-amount" name="amount" type="number" min={1} max={balance} step="0.01" required placeholder="Amount to withdraw" className={input} />
        <FieldErr msg={state?.errors?.amount} />
      </div>
      <button type="submit" disabled={pending || balance <= 0} className={`py-3 ${primaryBtn}`}>
        {pending ? "Submitting..." : "Request withdrawal"}
      </button>
    </form>
  );
}
