/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LOGIN CHALLENGE — proof that the password step actually happened.
 *
 * Login is now two steps: password, then a code emailed to the account. The
 * problem with splitting it across two requests is that the second one has to
 * know the first one succeeded.
 *
 * Without that proof this would not be two-factor at all. Anyone could skip
 * straight to the code page with somebody else's address, trigger an email,
 * and be one inbox away from the account — the password would have stopped
 * being a factor. So the password step issues a short-lived signed token, and
 * the code step refuses to run without a valid one.
 *
 * WHAT IT IS: email + destination + expiry, HMAC-SHA256 signed. It carries no
 * session and grants nothing on its own — holding it only earns the right to
 * be asked for a code.
 *
 * THE KEY is derived from SUPABASE_SECRET_KEY rather than being its own
 * environment variable: one fewer thing to set, and one fewer thing to leave
 * at a default. It is domain-separated by a label, so this signature can
 * never be confused with anything else signed by the same secret.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Long enough to read an email, short enough that a stolen one is useless. */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export const CHALLENGE_COOKIE = "rv_login_challenge";

const LABEL = "rydvest:login-challenge:v1";

type Challenge = {
  /** Who is logging in. The code page trusts this, never the query string. */
  email: string;
  /** Where they were headed before the login wall. Already path-validated. */
  next: string;
  /** Epoch milliseconds. */
  exp: number;
};

function key(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createHmac("sha256", secret).update(LABEL).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/** Issued once the password has been accepted. */
export function createChallenge(email: string, next: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, next, exp: Date.now() + CHALLENGE_TTL_MS } satisfies Challenge),
    "utf8"
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

/**
 * Returns the challenge, or null if it is missing, tampered with or expired.
 *
 * Never throws on bad input: a malformed cookie is an ordinary thing to
 * receive and simply means "no valid challenge".
 */
export function readChallenge(token: string | undefined): Challenge | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Constant-time: a length-leaking or early-exit compare would let somebody
  // discover a valid signature byte by byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Challenge;
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { email: parsed.email, next: typeof parsed.next === "string" ? parsed.next : "", exp: parsed.exp };
  } catch {
    return null;
  }
}

/**
 * The escape hatch.
 *
 * If email delivery breaks, two-step login locks EVERYONE out — including
 * every admin, including the person who would fix it. Setting
 * LOGIN_OTP_DISABLED=1 falls back to password-only so the business can keep
 * running while that is sorted out.
 *
 * It is deliberately an environment variable: changing it needs deploy access,
 * not merely an admin session.
 */
export function loginOtpDisabled(): boolean {
  return process.env.LOGIN_OTP_DISABLED === "1";
}
