/**
 * Formatting helpers shared by server and client components.
 * (No secrets here — safe to import anywhere.)
 */

/** ₦1,234,567 — whole-naira display. */
export function fmtNaira(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return "₦" + num.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

/** "12 Jul 2026" style date. Accepts Date, ISO string or null. */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/** 0–100 progress percentage of a pool. */
export function poolProgressPct(raised: number | string, target: number | string): number {
  const t = Number(target);
  if (!t) return 0;
  return Math.min(100, Math.round((Number(raised) / t) * 100));
}
