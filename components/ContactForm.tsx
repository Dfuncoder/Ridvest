"use client";

/**
 * Public "Talk to us" contact form — submits to the submitContact server
 * action, which stores the message and emails it to the support inbox.
 */
import { useActionState } from "react";
import { submitContact } from "@/app/actions/contact";
import type { FormState } from "@/app/actions/auth";

const input =
  "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5";

export default function ContactForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitContact, undefined);

  if (state?.success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-extrabold text-white mb-2">Message sent!</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.message && (
        <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          {state.message}
        </p>
      )}

      {/* Honeypot — invisible to humans, bots fill it and get silently dropped. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ct-name" className={label}>Your name</label>
          <input id="ct-name" name="name" type="text" required placeholder="Jude Mbakwe" autoComplete="name" className={input} />
          {state?.errors?.name && <p className="text-xs text-red-400 mt-1">{state.errors.name}</p>}
        </div>
        <div>
          <label htmlFor="ct-phone" className={label}>Phone <span className="normal-case font-normal text-slate-600">(optional)</span></label>
          <input id="ct-phone" name="phone" type="tel" placeholder="+234 800 000 0000" autoComplete="tel" className={input} />
        </div>
      </div>

      <div>
        <label htmlFor="ct-email" className={label}>Email address</label>
        <input id="ct-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email" className={input} />
        {state?.errors?.email && <p className="text-xs text-red-400 mt-1">{state.errors.email}</p>}
      </div>

      <div>
        <label htmlFor="ct-message" className={label}>How can we help?</label>
        <textarea
          id="ct-message"
          name="message"
          required
          rows={5}
          maxLength={3000}
          placeholder="Tell us what you'd like to know — investment plans, how pools work, partnership, anything."
          className={`${input} resize-y min-h-28`}
        />
        {state?.errors?.message && <p className="text-xs text-red-400 mt-1">{state.errors.message}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`w-full py-3.5 font-extrabold text-sm rounded-xl transition-all duration-150 shadow-lg shadow-amber-400/20 ${
          pending
            ? "bg-amber-400/50 text-[#0d2137] cursor-not-allowed"
            : "bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137]"
        }`}
      >
        {pending ? "Sending..." : "Send message →"}
      </button>
    </form>
  );
}
