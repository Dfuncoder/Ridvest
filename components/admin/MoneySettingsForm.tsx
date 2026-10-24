"use client";

/**
 * Limits, fees and the two service switches.
 *
 * Nothing here enforces anything. Every value is checked again by the action
 * and then enforced in SQL, inside the transaction that moves the money — the
 * form is a way to change a number, not the place the rule lives.
 *
 * The switches sit at the top because they are the controls somebody reaches
 * for in a hurry, usually on a phone, usually because something is wrong.
 */
import { useActionState, useState } from "react";
import { updateMoneySettings } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import type { MoneySettings } from "@/lib/settings";
import { fmtNaira } from "@/lib/format";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 tabular-nums placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

/** Groups the figure as it is typed, and posts the raw number alongside. */
function NairaField({
  name,
  labelText,
  hint,
  initial,
  error,
}: {
  name: string;
  labelText: string;
  hint: string;
  initial: number;
  error?: string;
}) {
  const [value, setValue] = useState(String(initial));

  return (
    <div>
      <label htmlFor={name} className={label}>
        {labelText}
      </label>
      {/* The visible box holds "2,000,000"; the hidden one carries the digits
          the server parses. Posting the grouped string would reach Zod as NaN. */}
      <input type="hidden" name={name} value={value} />
      <input
        id={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value === "" ? "" : Number(value).toLocaleString("en-NG")}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        className={input}
      />
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{hint}</p>
      <FieldErr msg={error} />
    </div>
  );
}

function Switch({
  name,
  title,
  blurb,
  on,
}: {
  name: string;
  title: string;
  blurb: string;
  on: boolean;
}) {
  const [checked, setChecked] = useState(on);

  return (
    <label
      htmlFor={name}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
        checked ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"
      }`}
    >
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{title}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
              checked ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {checked ? "Running" : "Paused"}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{blurb}</span>
      </span>
    </label>
  );
}

export function MoneySettingsForm({ settings }: { settings: MoneySettings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateMoneySettings,
    undefined
  );
  const err = (f: string) => state?.errors?.[f];

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.message && (
        <p
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            state.success
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <p className={label}>Service switches</p>
        <Switch
          name="withdrawalsEnabled"
          title="Withdrawals to bank"
          blurb="Untick to stop new withdrawal requests. Requests already approved are unaffected, and balances stay exactly as they are."
          on={settings.withdrawalsEnabled}
        />
        <Switch
          name="transfersEnabled"
          title="Sending between accounts"
          blurb="Untick to stop internal transfers. Use this when money looks like it is being moved between accounts to cover its tracks."
          on={settings.transfersEnabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NairaField
          name="withdrawalFee"
          labelText="Withdrawal fee (₦)"
          hint="Charged on top of the amount withdrawn. 0 means the user is charged nothing."
          initial={settings.withdrawalFee}
          error={err("withdrawalFee")}
        />
        <NairaField
          name="transferFee"
          labelText="Transfer fee (₦)"
          hint="Charged to the sender. The recipient always receives the full amount."
          initial={settings.transferFee}
          error={err("transferFee")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NairaField
          name="transferMinAmount"
          labelText="Smallest transfer (₦)"
          hint="Must be larger than the transfer fee."
          initial={settings.transferMinAmount}
          error={err("transferMinAmount")}
        />
        <NairaField
          name="transferMaxAmount"
          labelText="Largest single transfer (₦)"
          hint="The most that can move in one go."
          initial={settings.transferMaxAmount}
          error={err("transferMaxAmount")}
        />
        <NairaField
          name="transferMaxPerDay"
          labelText="Daily total per sender (₦)"
          hint="The real damage limit if an account is taken over."
          initial={settings.transferMaxPerDay}
          error={err("transferMaxPerDay")}
        />
        <NairaField
          name="transferMaxPerHour"
          labelText="Transfers per hour"
          hint="Stops a drained account being split across many small sends."
          initial={settings.transferMaxPerHour}
          error={err("transferMaxPerHour")}
        />
        <NairaField
          name="transferMaxLookupsHour"
          labelText="Account ID lookups per hour"
          hint="Stops anyone sweeping the RYD… space to harvest valid IDs."
          initial={settings.transferMaxLookupsHour}
          error={err("transferMaxLookupsHour")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#0d2137] px-5 py-2.5 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#143352] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save limits & fees"}
        </button>
        <p className="text-xs text-slate-400">
          Applies to the next transaction — currently {fmtNaira(settings.transferFee)} per transfer
          and {fmtNaira(settings.withdrawalFee)} per withdrawal.
        </p>
      </div>
    </form>
  );
}
