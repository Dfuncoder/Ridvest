"use client";

/**
 * CHANGE PASSWORD — the same form for a user and for an admin.
 *
 * Three fields and no cleverness: the current password, the new one, and the
 * new one again. The rules are stated up front rather than only after a
 * rejected attempt, because a password that gets refused twice is a password
 * somebody gives up on.
 *
 * Nothing here decides anything. The action re-validates every field and
 * re-checks the current password on the server; this is the part people see.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { changePassword } from "@/app/actions/auth";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "mb-1.5 block text-xs font-bold text-slate-700";

function Field({
  id,
  name,
  label: text,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={200}
          className={`${input} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 transition-colors hover:text-slate-700"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  const form = useRef<HTMLFormElement>(null);

  // Clear the boxes once it has gone through, so a shared screen is not left
  // holding the new password in plain sight behind a "Show" button.
  useEffect(() => {
    if (state?.success) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
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

      <Field
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        error={state?.errors?.currentPassword}
      />

      <Field
        id="newPassword"
        name="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter, a number and a symbol."
        error={state?.errors?.password}
      />

      <Field
        id="confirmPassword"
        name="confirmPassword"
        label="Repeat new password"
        autoComplete="new-password"
        error={state?.errors?.confirmPassword}
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[#0d2137] px-4 py-3 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#143352] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
