"use client";

import { useState } from "react";

/**
 * A code with a copy button. Used for pool invite codes, where the whole point
 * is to hand the string to somebody else.
 */
export function CopyCode({
  code,
  size = "sm",
}: {
  code: string;
  /** "lg" for the pool detail page, "sm" for list rows. */
  size?: "sm" | "lg";
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  async function copy(e: React.MouseEvent) {
    // List rows sit inside a Link — copying should not navigate.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const icon = copied ? (
    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );

  if (size === "lg") {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xl font-extrabold tracking-[0.25em] text-amber-600 truncate">
          {code}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Invite code copied" : "Copy invite code"}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 transition-colors"
        >
          {icon}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Invite code copied" : `Copy invite code ${code}`}
      className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-500 hover:text-amber-600 transition-colors"
    >
      Code: {code}
      {icon}
    </button>
  );
}
