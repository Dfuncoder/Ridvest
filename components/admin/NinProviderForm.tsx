"use client";

/**
 * Which provider answers a NIN lookup.
 *
 * Two radios and a save button. The reason it exists at all is that the other
 * arrangement — a code constant — means a provider going down takes identity
 * checks with it until somebody can deploy.
 */
import { useActionState, useState } from "react";
import { updateNinProvider } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import type { NinProvider } from "@/lib/nin";

const OPTIONS: Array<{ value: NinProvider; title: string; blurb: string }> = [
  {
    value: "korapay",
    title: "Korapay",
    blurb:
      "Uses the same secret key as payments. Identity lookups must be enabled on the Korapay account.",
  },
  {
    value: "monnify",
    title: "Monnify",
    blurb:
      "Billed per successful check against the Monnify wallet balance, and live credentials only — sandbox returns no real records.",
  },
];

export function NinProviderForm({ current }: { current: NinProvider }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateNinProvider,
    undefined
  );
  const [picked, setPicked] = useState<NinProvider>(current);

  return (
    <form action={action} className="flex flex-col gap-4">
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

      <div className="grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            htmlFor={`nin-${o.value}`}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
              picked === o.value
                ? "border-amber-400 bg-amber-50/60"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              id={`nin-${o.value}`}
              type="radio"
              name="provider"
              value={o.value}
              checked={picked === o.value}
              onChange={() => setPicked(o.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{o.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || picked === current}
          className="rounded-xl bg-[#0d2137] px-5 py-2.5 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#143352] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save provider"}
        </button>
        <p className="text-xs text-slate-400">
          Applies to the next lookup, including re-running one that already failed.
        </p>
      </div>
    </form>
  );
}
