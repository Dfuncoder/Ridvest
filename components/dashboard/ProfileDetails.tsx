"use client";

import { useState } from "react";

/**
 * The account ID, with a copy button. Shown on the profile as well as the
 * dashboard because this is the field people come looking for.
 */
export function CodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#0d2137] via-[#122c4b] to-[#193f68] px-5 py-4">
      <div
        className="hidden sm:block absolute -top-12 -right-10 w-40 h-40 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(250,204,21,0.16) 0%, transparent 68%)" }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-white/45 uppercase tracking-[0.16em] mb-1">
            Your account ID
          </p>
          <p className="font-mono text-xl font-bold text-white tracking-[0.12em] truncate">
            {code || "—"}
          </p>
          <p className="text-[11px] text-white/45 mt-1.5">
            Share this to receive money from another Rydvest user.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!code}
          aria-label={copied ? "Account ID copied" : "Copy account ID"}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-40"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
