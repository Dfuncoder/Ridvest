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

/** Unguessable single-use token for the "Received" link emailed to admins. */
export function generateConfirmToken(): string {
  return crypto.randomBytes(32).toString("hex");
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
