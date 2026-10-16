"use client";

/**
 * A 4-digit PIN box.
 *
 * One input per digit, because a single field with four characters in it is
 * fiddly on a phone and gives no sense of progress. Typing moves forward,
 * backspace moves back, and a pasted code fills the whole thing.
 *
 * The digits are masked and the real value is posted through a hidden field,
 * so the surrounding <form> needs no JavaScript of its own.
 *
 * `inputMode="numeric"` rather than `type="number"`: a number input on mobile
 * allows e, + and -, and some browsers strip leading zeros — which would
 * quietly turn the PIN 0421 into 421.
 */
import { useId, useRef, useState } from "react";

const LENGTH = 4;

export default function PinInput({
  name,
  label,
  autoFocus = false,
  error,
}: {
  name: string;
  label: string;
  autoFocus?: boolean;
  error?: string;
}) {
  const id = useId();
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const value = digits.join("");

  function setAt(index: number, next: string) {
    setDigits((prev) => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }

  function onChange(index: number, raw: string) {
    const only = raw.replace(/[^0-9]/g, "");
    if (!only) {
      setAt(index, "");
      return;
    }

    // A paste (or a fast typist) can deliver several digits at once.
    if (only.length > 1) {
      setDigits((prev) => {
        const copy = [...prev];
        for (let i = 0; i < only.length && index + i < LENGTH; i++) {
          copy[index + i] = only[i];
        }
        return copy;
      });
      const landed = Math.min(index + only.length, LENGTH - 1);
      refs.current[landed]?.focus();
      return;
    }

    setAt(index, only);
    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // Already empty: step back and clear the previous one, which is what
      // holding backspace is expected to do.
      e.preventDefault();
      setAt(index - 1, "");
      refs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div>
      <span className="block text-xs font-bold text-slate-700 mb-1.5">{label}</span>

      {/* The value the form actually posts. */}
      <input type="hidden" name={name} value={value} />

      <div className="flex gap-2.5" role="group" aria-label={label}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? id : undefined}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={LENGTH}
            aria-label={`Digit ${i + 1}`}
            autoFocus={autoFocus && i === 0}
            value={digit}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={`h-14 w-full max-w-14 rounded-xl border bg-white text-center text-xl font-extrabold text-slate-900 outline-none transition-colors focus:border-amber-400 ${
              error ? "border-red-300" : "border-slate-200"
            }`}
          />
        ))}
      </div>

      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
