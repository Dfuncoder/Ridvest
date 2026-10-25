"use client";

/**
 * The countdown on the holding page.
 *
 * It does not decide anything. The proxy decides, per request, from the same
 * MAINTENANCE_UNTIL instant — this is the visible half of that, and when it
 * reaches zero it reloads so the proxy can let the visitor through.
 *
 * The first render deliberately shows dashes rather than a number: the server
 * and the browser would compute "time remaining" a few hundred milliseconds
 * apart and React would report a hydration mismatch. The real figure arrives
 * on mount, one tick later, and nobody notices.
 */
import { useEffect, useState } from "react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number } | null;

function split(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-16 flex-col items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:min-w-18">
      <span className="text-2xl font-extrabold tabular-nums text-white sm:text-3xl">{value}</span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

export default function LaunchCountdown({ target }: { target: string }) {
  const at = new Date(target).getTime();
  const [left, setLeft] = useState<Remaining>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (Number.isNaN(at)) return;

    const tick = () => {
      const ms = at - Date.now();
      setLeft(split(ms));
      if (ms <= 0) setDone(true);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [at]);

  // One reload, once, when the clock runs out. The proxy is the thing that
  // actually opens the site; this just asks it again.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => window.location.reload(), 1500);
    return () => clearTimeout(id);
  }, [done]);

  if (Number.isNaN(at)) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (done) {
    return (
      <div className="mb-9 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-center lg:text-left">
        <p className="text-sm font-extrabold text-amber-400">We&apos;re live — opening now.</p>
        <p className="mt-1 text-xs text-slate-300">
          If this page is still here in a moment, refresh it.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-9">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Doors open in
      </p>
      <div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
        <Cell value={left ? String(left.days) : "–"} label={left?.days === 1 ? "day" : "days"} />
        <Cell value={left ? pad(left.hours) : "––"} label="hrs" />
        <Cell value={left ? pad(left.minutes) : "––"} label="mins" />
        <Cell value={left ? pad(left.seconds) : "––"} label="secs" />
      </div>
    </div>
  );
}
