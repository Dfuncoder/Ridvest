"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { setHideBalance } from "@/app/actions/account";
import { fmtNaira, fmtNairaCompact } from "@/lib/format";

/**
 * Hide/show for money figures, shared by the user dashboard and the admin
 * overview.
 *
 * The value lives on profiles.hide_balance and arrives with the server render,
 * so a page whose owner has hidden their figures is masked in the HTML itself
 * — nothing is painted and then blanked — and the choice follows the account
 * to any device.
 *
 * The click is optimistic and shared through context, so the icon AND every
 * figure flip together on the same frame; the write and revalidation happen
 * behind that. Waiting on a round trip to blank a number would defeat the
 * point of the button.
 */

const Ctx = createContext<{ hidden: boolean; toggle: () => void }>({
  hidden: false,
  toggle: () => {},
});

export function BalancePrivacy({
  initialHidden,
  children,
}: {
  initialHidden: boolean;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [hidden, setHidden] = useOptimistic(initialHidden);

  function toggle() {
    startTransition(async () => {
      const next = !hidden;
      setHidden(next);
      await setHideBalance(next);
    });
  }

  return <Ctx.Provider value={{ hidden, toggle }}>{children}</Ctx.Provider>;
}

/** One amount, already formatted. Masked when the preference is on. */
export function Money({ value }: { value: string }) {
  const { hidden } = useContext(Ctx);
  return <>{hidden ? "₦ ••••••" : value}</>;
}

/**
 * An amount for a narrow card: ₦3.9M on a phone, ₦3,900,000 from `sm` up.
 *
 * Three stat cards across a 360px screen leave about 70px of text each, and a
 * seven-figure naira amount needs more than that — so it used to run outside
 * the card. Swapped with CSS rather than a media-query hook so the server
 * renders both and neither flashes.
 *
 * Outside a BalancePrivacy provider the context default applies and figures
 * simply show, which is what pages without the toggle want anyway.
 */
export function ResponsiveMoney({ value }: { value: number }) {
  return (
    <>
      <span className="sm:hidden">
        <Money value={fmtNairaCompact(value)} />
      </span>
      <span className="hidden sm:inline">
        <Money value={fmtNaira(value)} />
      </span>
    </>
  );
}

export function BalanceToggle({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const { hidden, toggle } = useContext(Ctx);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      title={hidden ? "Show amounts" : "Hide amounts"}
      className={`shrink-0 flex items-center justify-center transition-colors ${
        tone === "dark" ? "text-white/40 hover:text-white/90" : "text-slate-400 hover:text-slate-700"
      } ${className}`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {hidden ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
          />
        ) : (
          <>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </>
        )}
      </svg>
    </button>
  );
}
