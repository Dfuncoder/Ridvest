/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MONNIFY — SERVER ONLY. Two jobs here, both about confirming who somebody is:
 *
 *   1. BANK ACCOUNT NAMES. Given a bank code and account number, Monnify says
 *      whose account it is. That name is what the withdrawal name-match rule
 *      compares against the profile — never a name the user typed.
 *
 *   2. NIN VERIFICATION. Given an NIN, NIMC returns the real first and last
 *      name on that record. Comparing those to the profile is what turns KYC
 *      from "a number was typed" into "this number belongs to this person".
 *
 * Payments stay on Korapay (lib/korapay.ts). Monnify is only used for these
 * lookups, so the two can be configured independently.
 *
 * ⚠ COST. NIN verification is billed per successful request (₦60 at the time
 *   of writing) and is drawn from the Monnify wallet balance — if that wallet
 *   is empty the call fails. Nothing here retries automatically for that
 *   reason; a failed check is recorded and an admin re-runs it deliberately.
 *
 * ⚠ ENVIRONMENT. Monnify's verification APIs run on LIVE only. Pointing
 *   MONNIFY_BASE_URL at sandbox gives working auth and bank lookups but NIN
 *   verification will not return real NIMC data.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";

/** Sandbox for bank lookups while testing; https://api.monnify.com for live. */
const BASE_URL = (process.env.MONNIFY_BASE_URL ?? "https://api.monnify.com").replace(/\/+$/, "");

export function monnifyConfigured(): boolean {
  return Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS TOKEN
//
// Monnify hands out a bearer token that lasts an hour or so. Cached in module
// scope and reused: logging in before every lookup would double the latency of
// each one and hammer the auth endpoint for nothing.
//
// The cache is per server instance, so a deploy or a cold start simply fetches
// a new one. Renewed a minute early so a token never expires mid-request.
// ─────────────────────────────────────────────────────────────────────────────
let cachedToken: { value: string; expiresAt: number } | null = null;
/** De-duplicates concurrent logins — ten parallel lookups make one token. */
let inFlight: Promise<string | null> | null = null;

const TOKEN_SAFETY_WINDOW_MS = 60_000;

/**
 * The last reason a login failed, so the NIN lookup can say "the key was
 * rejected" instead of the uselessly vague "Monnify is not configured".
 */
let lastLoginError: string | null = null;
async function fetchToken(): Promise<string | null> {
  const basic = Buffer.from(
    `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
  ).toString("base64");

  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    const token = json?.responseBody?.accessToken as string | undefined;
    const expiresIn = Number(json?.responseBody?.expiresIn ?? 0);

    if (!res.ok || !json?.requestSuccessful || !token) {
      // Structured, and with the response code Monnify sends alongside its
      // own message: "invalid credentials" and "this account cannot use this
      // service" arrive through the same HTTP status, and only the code tells
      // them apart.
      console.error(
        "[monnify] login failed",
        JSON.stringify({
          httpStatus: res.status,
          responseCode: json?.responseCode ?? null,
          message: json?.responseMessage ?? null,
          baseUrl: BASE_URL,
        })
      );
      lastLoginError = json?.responseMessage
        ? `login: ${json.responseMessage}`
        : `login: HTTP ${res.status}`;
      return null;
    }

    lastLoginError = null;
    cachedToken = {
      value: token,
      // expiresIn is seconds. Fall back to 10 minutes if it is missing, rather
      // than trusting a token for an unknown length of time.
      expiresAt: Date.now() + (expiresIn > 0 ? expiresIn * 1000 : 600_000) - TOKEN_SAFETY_WINDOW_MS,
    };
    return token;
  } catch (err) {
    console.error("[monnify] login error", err);
    lastLoginError = "login: could not reach Monnify";
    return null;
  }
}

/** Logged once per process, not once per lookup — this would otherwise fill the log. */
let warnedUnconfigured = false;

async function token(): Promise<string | null> {
  if (!monnifyConfigured()) {
    // The one place that knows WHY bank lookups and NIN checks are silently
    // doing nothing. The screens just say the feature is unavailable; the
    // reason belongs here, where whoever can fix it is looking.
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.error(
        "[monnify] MONNIFY_API_KEY and/or MONNIFY_SECRET_KEY are not set in this environment — " +
          "bank dropdowns, account-name checks and NIN verification are all disabled."
      );
    }
    return null;
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  if (!inFlight) {
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Shared envelope: every Monnify response has this shape. */
type Envelope<T> = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: T;
};

// ─────────────────────────────────────────────────────────────────────────────
// BANKS
// ─────────────────────────────────────────────────────────────────────────────

/** Same shape the rest of the app already expects from a bank list. */
export type Bank = { name: string; code: string; slug: string };

export async function monnifyListBanks(): Promise<{ ok: boolean; banks: Bank[] }> {
  const accessToken = await token();
  if (!accessToken) return { ok: false, banks: [] };

  try {
    const res = await fetch(`${BASE_URL}/api/v1/banks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // The bank list barely changes; caching it keeps the profile page quick.
      next: { revalidate: 60 * 60 * 24 },
    });

    const json = (await res.json().catch(() => null)) as Envelope<
      Array<{ name?: string; code?: string }>
    > | null;

    if (!res.ok || !json?.requestSuccessful || !Array.isArray(json.responseBody)) {
      console.error("[monnify] bank list failed", res.status, json?.responseMessage);
      return { ok: false, banks: [] };
    }

    const banks: Bank[] = json.responseBody
      .filter((b): b is { name: string; code: string } => Boolean(b?.name && b?.code))
      .map((b) => ({ name: b.name, code: b.code, slug: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { ok: true, banks };
  } catch (err) {
    console.error("[monnify] bank list error", err);
    return { ok: false, banks: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WHOSE ACCOUNT IS THIS?
// ─────────────────────────────────────────────────────────────────────────────

export type ResolvedAccount = {
  status: "ok" | "not_found" | "unavailable";
  accountName?: string;
  bankName?: string;
};

/** Asks Monnify whose account this is. Never call with a client-supplied name. */
export async function monnifyValidateAccount(
  bankCode: string,
  accountNumber: string
): Promise<ResolvedAccount> {
  const accessToken = await token();
  if (!accessToken) return { status: "unavailable" };

  const url =
    `${BASE_URL}/api/v2/disbursements/account/validate` +
    `?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Envelope<{
      accountName?: string;
      bankName?: string;
    }> | null;

    const name = json?.responseBody?.accountName;

    if (!res.ok || !json?.requestSuccessful || !name) {
      // A wrong number is a normal outcome, not an outage.
      if (res.status >= 400 && res.status < 500) return { status: "not_found" };
      console.error("[monnify] account validate failed", res.status, json?.responseMessage);
      return { status: "unavailable" };
    }

    return {
      status: "ok",
      accountName: name.trim(),
      bankName: json.responseBody?.bankName?.trim(),
    };
  } catch (err) {
    console.error("[monnify] account validate error", err);
    return { status: "unavailable" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NIN
//
// The request carries only the NIN. NIMC returns the names on the record, and
// WE decide whether they match the profile — Monnify is not told what name to
// expect, so it cannot be led to agree with one.
// ─────────────────────────────────────────────────────────────────────────────

// The shape now lives in lib/nin.ts, which both providers answer in. Re-exported
// so existing imports from here keep working.
export type { NinLookup } from "./nin";
import type { NinLookup } from "./nin";

export async function monnifyVerifyNin(nin: string): Promise<NinLookup> {
  const accessToken = await token();
  if (!accessToken) {
    // Says which of the two it is. "Not configured" sent somebody hunting for
    // a missing environment variable once when the keys were present and
    // simply being refused.
    return {
      status: "unavailable",
      message: lastLoginError
        ? `Monnify ${lastLoginError}`
        : monnifyConfigured()
          ? "Monnify login failed"
          : "Monnify is not configured (MONNIFY_API_KEY / MONNIFY_SECRET_KEY missing)",
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/vas/nin-verification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nin }),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Envelope<{
      nin?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: string;
      phoneNumber?: string;
      ninInformationMatch?: boolean;
    }> | null;

    const body = json?.responseBody;

    if (!res.ok || !json?.requestSuccessful || !body?.firstName || !body?.lastName) {
      const message = json?.responseMessage ?? `HTTP ${res.status}`;
      const code = json?.responseCode ?? null;
      // The response code is the part that identifies the problem: an account
      // without the VAS product enabled, an empty wallet and a bad NIN all
      // come back as a failure, and only this tells them apart.
      console.error(
        "[monnify] nin verification failed",
        JSON.stringify({ httpStatus: res.status, responseCode: code, message, baseUrl: BASE_URL })
      );
      // An NIN that does not exist is an answer, not a failure of ours. A 402
      // or 5xx is Monnify's side — usually an empty wallet — and must stay
      // distinguishable so an admin knows to top up rather than reject a user.
      // The code travels with the message so the admin screen shows it too —
      // Monnify names the problem in the code more often than in the text.
      const detail = code ? `${message} (code ${code})` : message;
      if (res.status === 404 || res.status === 400) {
        return { status: "not_found", message: detail };
      }
      return { status: "unavailable", message: detail };
    }

    return {
      status: "ok",
      nin: body.nin ?? nin,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      dateOfBirth: body.dateOfBirth?.trim(),
      gender: body.gender?.trim(),
      phoneNumber: body.phoneNumber?.trim(),
    };
  } catch (err) {
    console.error("[monnify] nin verification error", err);
    return { status: "unavailable", message: "Could not reach Monnify" };
  }
}
