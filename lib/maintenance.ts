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
 *  | "off:launched"; MAINTENANCE_MODE unset / 0   off everywhere
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

/** One warning per process, not one per request. */
let warnedAboutPastLaunch = false;

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
/**
 * The moment the holding page lets go of its own accord.
 *
 * MAINTENANCE_UNTIL is an ISO 8601 instant — include the offset, so there is
 * no argument about which clock it means:
 *
 *   2026-10-26T08:00:00+01:00   8am West Africa Time
 *   2026-10-26T07:00:00Z        the same instant, written in UTC
 *
 * Once it passes, every request is let through even with MAINTENANCE_MODE
 * still set. That is the point: launching should not depend on somebody being
 * awake to change an environment variable, and a site that stays dark because
 * the person with the Vercel login overslept is a worse failure than one that
 * opens a minute early.
 *
 * Unset or unparseable means "no scheduled end" — the flag alone decides, as
 * it always did.
 */
export function launchAt(): Date | null {
  const raw = (process.env.MAINTENANCE_UNTIL ?? "").trim();
  if (!raw) return null;
  const when = new Date(raw);
  return Number.isNaN(when.getTime()) ? null : when;
}

/** Has the scheduled launch moment passed? */
export function launched(now: number = Date.now()): boolean {
  const at = launchAt();
  return at !== null && now >= at.getTime();
}

export type MaintenanceDecision =
  /** MAINTENANCE_MODE is not set to anything truthy. */
  | "off"
  /** Serving the holding page. */
  | "hold"
  /** Spared: this is a Vercel preview deployment. */
  | "skip:preview"
  /** Spared: the host is listed in MAINTENANCE_LIVE_HOSTS. */
  | "skip:host"
  /** Spared: the scheduled launch moment has passed. */
  | "off:launched";

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

  // The clock outranks the flag. Checked before "all" as well, so there is one
  // rule to remember rather than two: after this instant, nobody is held.
  if (launched()) {
    // Said once per process, because the quiet version of this is somebody
    // setting MAINTENANCE_MODE=1 a month from now, seeing the site stay up,
    // and hunting through Vercel for a flag that was never the problem.
    if (!warnedAboutPastLaunch) {
      warnedAboutPastLaunch = true;
      console.warn(
        `[maintenance] MAINTENANCE_MODE is on, but MAINTENANCE_UNTIL (${
          launchAt()?.toISOString() ?? "?"
        }) has already passed, so the site is open. Clear that variable, or set it to a new time in the future, to hold the site again.`
      );
    }
    return "off:launched";
  }

  // "all" is the deliberate escape hatch for checking the page itself.
  if (mode === "all") return "hold";

  // Vercel sets this to "production" | "preview" | "development".
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "preview") return "skip:preview";

  const h = (host ?? "").toLowerCase().split(":")[0];
  if (h && liveHosts().includes(h)) return "skip:host";

  return "hold";
}

/**
 * Is this request hitting a non-production deployment?
 *
 * Two signals, same as the maintenance skip, because one can fail: Vercel's
 * own VERCEL_ENV, and the host allowlist. A branch deployment on a custom
 * domain — test.rydvest.com — does NOT get Vercel's automatic noindex, which
 * is how the test site ended up ranking in Google above the real one.
 */
export function isNonProductionHost(host?: string | null): boolean {
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "preview") return true;
  const h = (host ?? "").toLowerCase().split(":")[0];
  return Boolean(h) && liveHosts().includes(h);
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
