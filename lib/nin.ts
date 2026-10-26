/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHO LOOKS UP A NIN — and the one shape both answers come back in.
 *
 * Two providers can answer the same question, so the rest of the app asks
 * verifyNin() and never names one. Which is used is an admin setting rather
 * than an environment variable on purpose: when a provider stops answering —
 * an empty wallet, an expired key, an outage on their side — the fix is one
 * click at 9pm, not a redeploy by whoever has the Vercel login.
 *
 * No provider is told what name to expect. Each is sent a number and
 * nothing else, and the comparison is ours (lib/names.ts), so a provider
 * cannot be led into agreeing with a name we supplied, and all three answer
 * the same question in the same way.
 *
 * Facial matching is offered by more than one of them and used by none. It
 * means posting a customer's face to a third party on every submission, and
 * the admin already compares the selfie to the NIMC record by eye on the
 * review screen.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";

export type NinProvider = "monnify" | "korapay" | "ninja";

export const NIN_PROVIDERS: NinProvider[] = ["ninja", "korapay", "monnify"];

/** What a lookup can tell us, whoever answered it. */
export type NinLookup =
  | {
      status: "ok";
      nin: string;
      firstName: string;
      lastName: string;
      dateOfBirth?: string;
      gender?: string;
      phoneNumber?: string;
    }
  /** The number is not on the national record. An answer, not a failure. */
  | { status: "not_found"; message: string }
  /** We could not get an answer. Says nothing about the customer. */
  | { status: "unavailable"; message: string };

export function isNinProvider(value: unknown): value is NinProvider {
  return value === "monnify" || value === "korapay" || value === "ninja";
}

/**
 * Runs the lookup with whichever provider the admin has selected.
 *
 * Imported lazily so a deployment missing one provider's configuration does
 * not pull its module in at all, and so the three stay independent — none
 * knows the others exist.
 *
 * @param reference our own id for this submission, passed to providers that
 *        record one, so a support conversation can name the exact call.
 */
export async function verifyNin(
  nin: string,
  provider: NinProvider,
  reference?: string
): Promise<NinLookup> {
  if (provider === "ninja") {
    const { ninjaVerifyNin } = await import("./ninja");
    return ninjaVerifyNin(nin, reference);
  }
  if (provider === "korapay") {
    const { korapayVerifyNin } = await import("./korapay");
    return korapayVerifyNin(nin);
  }
  const { monnifyVerifyNin } = await import("./monnify");
  return monnifyVerifyNin(nin);
}
