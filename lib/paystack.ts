/**
 * Paystack API helpers — SERVER ONLY (the secret key lives here).
 *
 * Payment security model:
 *   1. We create an investment row (status pending_payment) with OUR OWN
 *      unique reference, then initialize a Paystack transaction with the
 *      amount, email and that reference. The user pays on Paystack's page.
 *   2. Money only ever counts when Paystack calls our webhook
 *      (app/api/webhooks/paystack). There we:
 *        a. verify the x-paystack-signature HMAC (proves it's Paystack),
 *        b. re-verify the transaction with Paystack's API (belt & braces),
 *        c. hand off to the atomic SQL function apply_paid_investment(),
 *           which also re-checks the paid amount to the kobo.
 *   The client redirect after payment is treated as UNTRUSTED — it only
 *   triggers a status check, never a credit.
 */
import "server-only";
import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

type InitializeParams = {
  email: string;
  /** Amount in KOBO (₦1 = 100 kobo). Must be an integer. */
  amountKobo: number;
  /** Our unique reference — also the idempotency key in the database. */
  reference: string;
  /** Where Paystack redirects the browser after payment. */
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

/** Starts a Paystack transaction; returns the hosted checkout URL. */
export async function paystackInitialize(params: InitializeParams): Promise<{
  ok: boolean;
  authorizationUrl?: string;
}> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: "NGN",
      metadata: params.metadata ?? {},
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status || !json?.data?.authorization_url) {
    console.error("[paystack] initialize failed", res.status, json?.message);
    return { ok: false };
  }
  return { ok: true, authorizationUrl: json.data.authorization_url };
}

export type PaystackVerifyResult = {
  ok: boolean;
  /** true only when Paystack says status === "success" */
  paid: boolean;
  amountKobo: number;
  reference: string;
};

/** Asks Paystack directly whether a transaction really succeeded. */
export async function paystackVerify(reference: string): Promise<PaystackVerifyResult> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey()}` },
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    return { ok: false, paid: false, amountKobo: 0, reference };
  }
  return {
    ok: true,
    paid: json.data?.status === "success",
    amountKobo: Number(json.data?.amount ?? 0),
    reference: json.data?.reference ?? reference,
  };
}

/**
 * Verifies the `x-paystack-signature` header on webhook requests:
 * HMAC-SHA512 of the RAW request body using the secret key. Uses a
 * timing-safe comparison so signatures can't be brute-forced byte by byte.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Generates our unique payment reference, e.g. RYDV-1720000000-AB12CD34. */
export function generatePaymentReference(): string {
  return `RYDV-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
