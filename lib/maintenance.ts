/**
 * Maintenance mode.
 *
 * Production (rydvest.com) shows a launch page while the real site is still
 * being built on test.rydvest.com. This is a runtime switch rather than a
 * different branch, so both deployments run byte-identical code and merging
 * test into main never has to untangle a "remove the holding page" commit.
 *
 * ── Why it is not just a boolean ──
 * The Vercel environment variables here are shared between Production and
 * Preview, so MAINTENANCE_MODE=1 alone would hide the test site too. The code
 * works out where it is running instead:
 *
 *   MAINTENANCE_MODE unset / 0   off everywhere
 *   MAINTENANCE_MODE=1           on, EXCEPT on preview deployments
 *   MAINTENANCE_MODE=all         on everywhere, including preview and local
 *                                (use this to check the page itself)
 *
 * Preview is detected two ways, so one failing does not take the test site
 * down: Vercel's own VERCEL_ENV, and a host allowlist you can set explicitly.
 *
 *   MAINTENANCE_LIVE_HOSTS=test.rydvest.com,staging.rydvest.com
 *
 * MAINTENANCE_BYPASS_TOKEN lets you through the holding page on production:
 * visit https://rydvest.com/?preview=<token> once and a cookie keeps you
 * through for 12 hours.
 */

export const BYPASS_COOKIE = "rv_preview";

function setting(): string {
  return (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase();
}

/** Hosts that must always serve the real site, whatever the flag says. */
function liveHosts(): string[] {
  return (process.env.MAINTENANCE_LIVE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Should this request see the holding page?
 *
 * @param host the request's Host header, so a preview domain can be spared
 *             even if the environment variables are identical to production's.
 */
export type MaintenanceDecision =
  /** MAINTENANCE_MODE is not set to anything truthy. */
  | "off"
  /** Serving the holding page. */
  | "hold"
  /** Spared: this is a Vercel preview deployment. */
  | "skip:preview"
  /** Spared: the host is listed in MAINTENANCE_LIVE_HOSTS. */
  | "skip:host";

/**
 * Should this request see the holding page, and why?
 *
 * The reason is surfaced as the x-rv-maintenance response header, so a single
 * curl tells you which branch fired instead of guessing at env vars.
 *
 * @param host the request's Host header, so a preview domain can be spared
 *             even if the environment variables are identical to production's.
 */
export function maintenanceDecision(host?: string | null): MaintenanceDecision {
  const mode = setting();
  if (mode !== "1" && mode !== "true" && mode !== "on" && mode !== "all") return "off";

  // "all" is the deliberate escape hatch for checking the page itself.
  if (mode === "all") return "hold";

  // Vercel sets this to "production" | "preview" | "development".
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "preview") return "skip:preview";

  const h = (host ?? "").toLowerCase().split(":")[0];
  if (h && liveHosts().includes(h)) return "skip:host";

  return "hold";
}

export function maintenanceEnabled(host?: string | null): boolean {
  return maintenanceDecision(host) === "hold";
}

export function bypassToken(): string | null {
  const raw = (process.env.MAINTENANCE_BYPASS_TOKEN ?? "").trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Paths that must keep working while the holding page is up:
 *   /maintenance  the page itself
 *   /api          webhooks above all — a blocked payment callback fails silently
 *   /_next, assets, and the metadata files Next generates
 */
export function alwaysAllowed(path: string): boolean {
  return (
    path === "/maintenance" ||
    path.startsWith("/api/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/_next/") ||
    path === "/favicon.svg" ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    /\.(png|jpg|jpeg|svg|webp|gif|ico|txt|xml|woff2?)$/i.test(path)
  );
}
