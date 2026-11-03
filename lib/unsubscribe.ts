/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNSUBSCRIBE LINKS — one click, no login, nobody else's inbox
 *
 * The link in a broadcast has to work for somebody who is not signed in and
 * will not sign in — that is the whole point of an unsubscribe. So it cannot
 * be `/unsubscribe?id=<user id>`: anybody could walk a list of ids and opt
 * every customer out of hearing from us.
 *
 * Instead the id is signed. The token carries the user id and an HMAC of it,
 * so a link only works for the address it was mailed to, and editing the id
 * invalidates the signature.
 *
 * No expiry on purpose. An unsubscribe link in a year-old email must still
 * work — a dead opt-out link is how a company ends up reported as spam.
 *
 * The key is derived from SUPABASE_SECRET_KEY with its own label, so one of
 * these tokens can never be mistaken for a login challenge or a signup
 * confirmation signed by the same secret.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const LABEL = "rydvest:unsubscribe:v1";

function key(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createHmac("sha256", secret).update(LABEL).digest();
}

function sign(userId: string): string {
  return createHmac("sha256", key()).update(userId).digest("base64url");
}

/** `<user id>.<signature>` — safe in a URL, meaningless anywhere else. */
export function unsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** The absolute link to put in an email. */
export function unsubscribeUrl(userId: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rydvest.com").replace(/\/+$/, "");
  return `${site}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(userId))}`;
}

/**
 * The user id a token vouches for, or null.
 *
 * Never throws: a mangled token is an ordinary thing to receive — mail
 * clients wrap long URLs — and means "no".
 */
export function readUnsubscribeToken(token: string | undefined | null): string | null {
  if (!token) return null;

  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;

  const userId = token.slice(0, cut);
  const signature = token.slice(cut + 1);

  let expected: string;
  try {
    expected = sign(userId);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Constant-time: an early-exit compare leaks a valid signature byte by byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}
