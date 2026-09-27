/**
 * Does a bank account name belong to this Rydvest user?
 *
 * The rule used to be an exact string match, which worked while the user typed
 * the account name themselves. Now the name comes from the bank, and banks
 * return the full legal name in their own order:
 *
 *   profile  "Jude Mbakwe"
 *   bank     "MBAKWE JUDE CHUKWUEMEKA"
 *
 * Those are the same person, and an exact match rejects them. So instead:
 * every meaningful word of the profile name must appear in the account name.
 * That tolerates reordering, extra middle names and punctuation, while still
 * rejecting an account belonging to somebody else.
 *
 * Mirrored by public.names_match() in supabase/migrate-bank-name-match.sql —
 * change both together, since the database is the real enforcement point.
 */

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    // Strip anything that isn't a letter, digit or space (hyphens, apostrophes,
    // the "MRS" style punctuation some banks add).
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** Honorifics banks prepend that carry no identifying information. */
const TITLES = new Set(["mr", "mrs", "miss", "ms", "dr", "chief", "alhaji", "engr", "prof"]);

export function namesMatch(accountName: string, profileName: string): boolean {
  const account = new Set(tokens(accountName).filter((t) => !TITLES.has(t)));
  const profile = tokens(profileName).filter((t) => !TITLES.has(t));

  // A profile name with nothing usable in it can never be verified.
  if (profile.length === 0 || account.size === 0) return false;

  return profile.every((t) => account.has(t));
}
