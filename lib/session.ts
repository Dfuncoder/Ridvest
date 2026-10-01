/**
 * Idle-session policy.
 *
 * Supabase refresh tokens never expire, and the dashboard settings that would
 * time-box them are Pro-only, so the timeout is enforced by us: every
 * authenticated request stamps profiles.last_active_at, and a request that
 * arrives after the window has passed is signed out.
 *
 * Tune with SESSION_IDLE_MINUTES (no redeploy needed on Vercel — it is read per
 * request). Rough guide:
 *   30    bank-grade, expect frequent logins
 *   480   a working day — the default
 *   10080 a week, lenient
 *   0     disables the timeout
 */
import "server-only";

const DEFAULT_IDLE_MINUTES = 480;

export function idleTimeoutMinutes(): number {
  const raw = process.env.SESSION_IDLE_MINUTES;
  if (raw === undefined || raw.trim() === "") return DEFAULT_IDLE_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_IDLE_MINUTES;
  return Math.floor(parsed);
}
