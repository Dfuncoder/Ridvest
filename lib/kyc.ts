/**
 * Shared KYC rules that both the server and the admin UI need to agree on.
 *
 * Plain functions with no imports, so the admin page (server) and the re-run
 * button (client) decide staleness identically — a button that offers a re-run
 * the server then refuses would be worse than no button.
 */

/**
 * How long a lookup may sit at 'checking' before we treat it as dead.
 *
 * The call itself takes seconds. Anything still "running" after this did not
 * survive the request that started it — a deploy mid-flight, or a killed cold
 * start — and nothing will ever finish it.
 */
export const LOOKUP_STALE_AFTER_MS = 5 * 60 * 1000;

/** True when a 'checking' row has been abandoned and may be run again. */
export function lookupIsStale(startedAt: string | null | undefined): boolean {
  if (!startedAt) return true; // No start time recorded: nothing to wait for.
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return true;
  return Date.now() - started > LOOKUP_STALE_AFTER_MS;
}
