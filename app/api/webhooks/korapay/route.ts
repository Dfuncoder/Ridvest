/**
 * KORAPAY WEBHOOK — the only place a Korapay top-up is ever credited.
 *
 * Defense in depth:
 *   1. SIGNATURE — x-korapay-signature must be the HMAC-SHA256 of the payload's
 *      `data` object under our secret key (timing-safe compare).
 *   2. RE-VERIFY — we then ask Korapay's own API whether the charge succeeded.
 *      A forged or replayed body cannot invent a successful payment.
 *   3. ATOMIC APPLY — apply_paid_deposit() locks the row and is idempotent, so
 *      retries and double-deliveries credit exactly once.
 *
 * Set this URL in the Korapay dashboard under Settings → API Configuration:
 *   https://YOUR-DOMAIN/api/webhooks/korapay
 */
import { NextResponse } from "next/server";
import { verifyKorapaySignature, korapayVerify } from "@/lib/korapay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type KorapayEvent = {
  event?: string;
  data?: { reference?: string; status?: string; amount?: number };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-korapay-signature");

  let event: KorapayEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!verifyKorapaySignature(event.data, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const reference = event.data?.reference;
  if (!reference || event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const verification = await korapayVerify(reference);
  if (!verification.ok || !verification.paid) {
    console.error("[webhook] korapay verification failed for", reference, verification.status);
    return NextResponse.json({ received: true, applied: false });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_paid_deposit", {
    p_reference: reference,
    p_amount_kobo: verification.amountKobo,
  });

  if (error) {
    console.error("[webhook] apply_paid_deposit failed", error);
    // 500 so Korapay retries; the function is idempotent.
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true, result: data });
}
