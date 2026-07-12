/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYSTACK WEBHOOK — the ONLY place money is ever credited.
 *
 * Paystack POSTs here on every payment event. Defense in depth:
 *   1. SIGNATURE — x-paystack-signature must be the HMAC-SHA512 of the raw
 *      body under our secret key (timing-safe compare). Anyone else posting
 *      here gets a 401 and nothing happens.
 *   2. RE-VERIFY — even with a valid signature we call Paystack's verify API
 *      ourselves and only proceed if PAYSTACK says status === "success".
 *      A forged/replayed body cannot invent a successful charge.
 *   3. ATOMIC APPLY — apply_paid_investment() in Postgres re-checks the paid
 *      amount to the kobo, locks rows, and is idempotent, so webhook retries
 *      and double-deliveries can never double-credit.
 *
 * Configure in Paystack Dashboard → Settings → API Keys & Webhooks:
 *   Webhook URL = https://YOUR-DOMAIN/api/webhooks/paystack
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { NextResponse } from "next/server";
import { verifyPaystackSignature, paystackVerify } from "@/lib/paystack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // The signature is computed over the RAW body — read it as text first.
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  // 1. Reject anything not signed by Paystack.
  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // We only care about successful charges. Acknowledge everything else so
  // Paystack doesn't keep retrying.
  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const reference = event.data.reference;

  // 2. Independently confirm with Paystack before touching the database.
  const verification = await paystackVerify(reference);
  if (!verification.ok || !verification.paid) {
    console.error("[webhook] verification failed for", reference);
    // 200 so Paystack doesn't retry forever; the payment simply isn't applied.
    return NextResponse.json({ received: true, applied: false });
  }

  // 3. Apply atomically. Amount is re-checked to the kobo inside the function.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_paid_investment", {
    p_reference: reference,
    p_amount_kobo: verification.amountKobo,
  });

  if (error) {
    console.error("[webhook] apply_paid_investment failed", error);
    // 500 → Paystack retries later, and the function is idempotent.
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  console.log("[webhook] applied", reference, data);
  return NextResponse.json({ received: true, result: data });
}
