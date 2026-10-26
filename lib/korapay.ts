/**
 * Korapay API helpers — SERVER ONLY (the secret key lives here).
 *
 * Security model for a top-up:
 *   1. We create a deposit row (status pending) with our own unique reference,
 *      then initialize a Korapay charge for that amount and reference. The
 *      user pays on Korapay's hosted checkout.
 *   2. Money only counts when the webhook (app/api/webhooks/korapay) fires. It
 *      checks the x-korapay-signature HMAC, then independently re-queries
 *      Korapay's API before crediting anything.
 *   3. apply_paid_deposit() in Postgres credits the amount Korapay reports,
 *      once, no matter how many times the webhook is delivered.
 *   The browser redirect after checkout is UNTRUSTED — it only triggers the
 *   same verify-then-apply path, never a credit on its own.
 *
 * Korapay speaks naira (major units); our SQL takes kobo. Every amount
 * crossing this boundary is converted here.
 */
import "server-only";
import crypto from "crypto";
import type { NinLookup } from "./nin";

const BASE_URL = "https://api.korapay.com/merchant/api/v1";

function secretKey(): string {
  const key = process.env.KORAPAY_SECRET_KEY;
  if (!key) throw new Error("KORAPAY_SECRET_KEY is not set");
  return key;
}

export function nairaToKobo(naira: number): number {
  return Math.round(Number(naira) * 100);
}

/** RYDV-DEP-1720000000-AB12CD34 */
export function generateDepositReference(): string {
  return `RYDV-DEP-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Unguessable single-use token for the "Received" link emailed to admins.
 * base64url keeps it to 24 characters (144 bits of entropy) — short enough
 * that mail clients do not wrap the confirmation URL onto a second line.
 */
export function generateConfirmToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

type InitializeParams = {
  email: string;
  name: string;
  /** Amount in KOBO. */
  amountKobo: number;
  reference: string;
  redirectUrl: string;
  notificationUrl: string;
  narration?: string;
};

export async function korapayInitialize(params: InitializeParams): Promise<{
  ok: boolean;
  checkoutUrl?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/charges/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amountKobo / 100,
        currency: "NGN",
        reference: params.reference,
        narration: params.narration ?? "Rydvest wallet funding",
        channels: ["card", "bank_transfer"],
        customer: { email: params.email, name: params.name },
        redirect_url: params.redirectUrl,
        notification_url: params.notificationUrl,
        merchant_bears_cost: false,
      }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    const checkoutUrl = json?.data?.checkout_url as string | undefined;
    if (!res.ok || !json?.status || !checkoutUrl) {
      console.error("[korapay] initialize failed", res.status, json?.message);
      return { ok: false };
    }
    return { ok: true, checkoutUrl };
  } catch (err) {
    console.error("[korapay] initialize error", err);
    return { ok: false };
  }
}

export type KorapayVerifyResult = {
  ok: boolean;
  /** true only when Korapay says the money actually landed */
  paid: boolean;
  amountKobo: number;
  reference: string;
  status: string;
};

/**
 * Asks Korapay directly whether a charge succeeded, keyed by OUR reference.
 * "processing" is not paid — the transfer may still fail, so we wait for a
 * later webhook rather than crediting optimistically.
 */
export async function korapayVerify(reference: string): Promise<KorapayVerifyResult> {
  const unverified = { paid: false, amountKobo: 0, reference, status: "" };

  try {
    const res = await fetch(`${BASE_URL}/charges/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey()}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.status || !json?.data) {
      return { ok: false, ...unverified };
    }

    const status = String(json.data.status ?? "");
    return {
      ok: true,
      paid: status === "success",
      amountKobo: nairaToKobo(json.data.amount ?? 0),
      reference: json.data.reference ?? reference,
      status,
    };
  } catch (err) {
    console.error("[korapay] verify error", err);
    return { ok: false, ...unverified };
  }
}

/**
 * Verifies the `x-korapay-signature` header.
 *
 * Korapay signs ONLY the `data` object of the payload — not the whole body —
 * as HMAC-SHA256 hex under the secret key. That means the signature does not
 * cover the event name, and re-serializing parsed JSON is sensitive to key
 * order, which is exactly why the webhook re-queries the API before crediting
 * rather than trusting this check alone.
 */
export function verifyKorapaySignature(data: unknown, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secretKey())
    .update(JSON.stringify(data))
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// BANK LOOKUP
//
// Used when a user adds a withdrawal account: they pick a bank and type an
// account number, and Korapay tells us the name on that account. The resolved
// name is what we store — a name the user typed themselves proves nothing.
//
// Both calls need KORAPAY_SECRET_KEY even when collections are set to manual
// bank transfer. If the key is missing they report `unavailable` so the caller
// can fall back to manual entry rather than blocking withdrawals entirely.
// ─────────────────────────────────────────────────────────────────────────────

export type Bank = { name: string; code: string; slug: string };

export function korapayConfigured(): boolean {
  return Boolean(process.env.KORAPAY_SECRET_KEY);
}

export async function korapayListBanks(): Promise<{ ok: boolean; banks: Bank[] }> {
  if (!korapayConfigured()) return { ok: false, banks: [] };

  try {
    const res = await fetch(`${BASE_URL}/misc/banks?countryCode=NG`, {
      headers: { Authorization: `Bearer ${secretKey()}` },
      // The bank list barely changes; caching it keeps the profile page quick.
      next: { revalidate: 60 * 60 * 24 },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.status || !Array.isArray(json.data)) {
      console.error("[korapay] bank list failed", res.status, json?.message);
      return { ok: false, banks: [] };
    }

    const banks: Bank[] = json.data
      .filter((b: { name?: string; code?: string }) => b?.name && b?.code)
      .map((b: { name: string; code: string; slug?: string }) => ({
        name: b.name,
        code: b.code,
        slug: b.slug ?? b.code,
      }))
      .sort((a: Bank, b: Bank) => a.name.localeCompare(b.name));

    return { ok: true, banks };
  } catch (err) {
    console.error("[korapay] bank list error", err);
    return { ok: false, banks: [] };
  }
}

export type ResolvedAccount = {
  status: "ok" | "not_found" | "unavailable";
  accountName?: string;
  bankName?: string;
};

/** Asks Korapay whose account this is. Never call with client-supplied names. */
export async function korapayResolveAccount(
  bankCode: string,
  accountNumber: string
): Promise<ResolvedAccount> {
  if (!korapayConfigured()) return { status: "unavailable" };

  try {
    const res = await fetch(`${BASE_URL}/misc/banks/resolve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bank: bankCode, account: accountNumber, currency: "NGN" }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    const name = json?.data?.account_name as string | undefined;

    if (!res.ok || !json?.status || !name) {
      // A wrong number is a normal outcome, not an outage.
      if (res.status >= 400 && res.status < 500) return { status: "not_found" };
      console.error("[korapay] resolve failed", res.status, json?.message);
      return { status: "unavailable" };
    }

    return {
      status: "ok",
      accountName: name.trim(),
      bankName: (json.data.bank_name as string | undefined)?.trim(),
    };
  } catch (err) {
    console.error("[korapay] resolve error", err);
    return { status: "unavailable" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NIN VERIFICATION
//
// POST /identities/ng/nin, authenticated with the same secret key as payments.
//
// Facial matching is deliberately NOT used. Korapay will compare a selfie
// against the NIMC photo if you send one, but that means posting a customer's
// face to a payment processor on every submission, and the admin already
// compares the two images by eye on the review screen. The lookup gives us the
// name on the national record, which is the fact we actually act on.
//
// Data matching is not used either, for a duller reason: Korapay compares the
// strings it is given, and Nigerian names arrive in whatever order the holder
// wrote them. namesMatch() in lib/names.ts already handles that, and doing the
// comparison ourselves keeps both providers answering the same question.
//
// verification_consent must be true or the check is refused. It is true: the
// user typed their own NIN into our form and asked us to verify it.
// ─────────────────────────────────────────────────────────────────────────────
export async function korapayVerifyNin(nin: string): Promise<NinLookup> {
  const key = process.env.KORAPAY_SECRET_KEY;
  if (!key) {
    return { status: "unavailable", message: "Korapay is not configured" };
  }

  try {
    const res = await fetch(`${BASE_URL}/identities/ng/nin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: nin, verification_consent: true }),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: {
        id?: string;
        first_name?: string;
        last_name?: string;
        middle_name?: string;
        date_of_birth?: string;
        gender?: string;
        phone_number?: string;
      };
    } | null;

    const data = json?.data;

    if (!res.ok || json?.status !== true || !data?.first_name || !data?.last_name) {
      const message = json?.message ?? `HTTP ${res.status}`;
      // Logged with the status code before any branching: when an integration
      // is new, "which of these three things is wrong" is answered by the
      // number, and a 401 reads very differently from a 403 or a 404.
      console.error(
        "[korapay] nin verification failed",
        JSON.stringify({ httpStatus: res.status, korapayStatus: json?.status ?? null, message })
      );
      // A NIN that does not exist is an answer, not a failure of ours. Anything
      // else — a 401, a 402 for an empty balance, a 5xx — is Korapay's side and
      // has to stay distinguishable, or an admin rejects a real customer over
      // an outage.
      if (res.status === 404 || res.status === 400) {
        return { status: "not_found", message };
      }
      return { status: "unavailable", message };
    }

    return {
      status: "ok",
      nin: data.id ?? nin,
      firstName: data.first_name.trim(),
      lastName: data.last_name.trim(),
      dateOfBirth: data.date_of_birth?.trim(),
      gender: data.gender?.trim(),
      phoneNumber: data.phone_number?.trim(),
    };
  } catch (err) {
    console.error("[korapay] nin verification error", err);
    return { status: "unavailable", message: "Could not reach Korapay" };
  }
}
