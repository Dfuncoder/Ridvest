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
 * Neither provider is told what name to expect. Both are sent a number and
 * nothing else, and the comparison is ours (lib/names.ts), so a provider
 * cannot be led into agreeing with a name we supplied, and both are answering
 * the same question in the same way.
 *
 * Facial matching is available from both and is used from neither. It means
 * posting a customer's face to a payment processor on every submission, and
 * the admin already compares the selfie to the NIMC record by eye on the
 * review screen.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";

export type NinProvider = "monnify" | "korapay";

export const NIN_PROVIDERS: NinProvider[] = ["monnify", "korapay"];

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
  return value === "monnify" || value === "korapay";
}

/**
 * Runs the lookup with whichever provider the admin has selected.
 *
 * Imported lazily so a deployment missing one provider's configuration does
 * not pull its module in at all, and so the two stay independent — neither
 * knows the other exists.
 */
export async function verifyNin(nin: string, provider: NinProvider): Promise<NinLookup> {
  if (provider === "korapay") {
    const { korapayVerifyNin } = await import("./korapay");
    return korapayVerifyNin(nin);
  }
  const { monnifyVerifyNin } = await import("./monnify");
  return monnifyVerifyNin(nin);
}
