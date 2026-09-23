/**
 * Safe post-login redirect targets.
 *
 * A `next` parameter is attacker-controllable — anyone can email a link like
 * /login?next=https://evil.example and, if we redirected blindly, the victim
 * would land there wearing a fresh Rydvest session. Only same-site absolute
 * paths are ever accepted; anything else falls back to the caller's default.
 *
 * Shared by the proxy, the login page and the login action so all three agree
 * on what counts as safe.
 */

/** Paths a login redirect must never land on (they'd bounce straight back). */
const BLOCKED_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-otp"];

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Must be a single absolute path. "//evil.com" and "/\evil.com" are
  // protocol-relative URLs that browsers treat as another origin.
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;

  // No scheme, no control characters, no newline splitting.
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;
  if (raw.includes("://")) return null;

  const path = raw.split("?")[0].split("#")[0];
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  return raw;
}
