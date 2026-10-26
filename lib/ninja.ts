/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NINJA — NIN lookups, as a third option behind the admin setting.
 *
 * One POST, one header. No token exchange, no caching, nothing to refresh:
 * the secret key goes straight into Authorization and does not expire. That
 * alone removes the failure mode Monnify has, where a login step can fail
 * separately from the lookup and the reasons get confused.
 *
 * ── TWO THINGS THAT WILL BITE ────────────────────────────────────────────
 *   1. Keys belong to an environment. A sandbox key (sk_sandbox_…) is refused
 *      with 401 on the live host and vice versa, so NINJA_BASE_URL and
 *      NINJA_SECRET_KEY have to agree. The error says which is wrong; it is
 *      logged verbatim.
 *   2. A request carrying an Origin header is refused with 403, because that
 *      is how a browser would look. Everything here runs on the server, so
 *      none is sent — but it is the reason this must never be called from a
 *      client component.
 *
 * ── MODE: LOOKUP, NOT VERIFY ─────────────────────────────────────────────
 * Ninja can compare details we supply and return a yes/no instead of the
 * record. We ask for the record and compare the names ourselves, the same way
 * we do with the other two: Nigerian names arrive in whatever order the
 * holder wrote them, and lib/names.ts already handles that. It also keeps the
 * three providers answering one question in one way.
 *
 * At Basic level the record is names, gender and age — date of birth, photo
 * and contact details come back empty and listed in `redacted`. That is
 * enough: the name is what the verification rests on.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import type { NinLookup } from "./nin";

const LIVE_URL = "https://api.ninja.boucloud.io";

function baseUrl(): string {
  return (process.env.NINJA_BASE_URL ?? LIVE_URL).trim().replace(/\/+$/, "");
}

type IdentifyResponse = {
  status?: "found" | "not_found";
  data?: {
    id_number?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    gender?: string;
    date_of_birth?: string;
    mobile?: string;
    level?: string;
  } | null;
  // The error shape: { type, code, message }.
  type?: string;
  code?: string;
  message?: string;
};

/**
 * @param reference our own correlation id, echoed back in X-Reference and
 *        stored in Ninja's request log — so a support conversation about one
 *        submission can name the exact call.
 */
export async function ninjaVerifyNin(nin: string, reference?: string): Promise<NinLookup> {
  const key = (process.env.NINJA_SECRET_KEY ?? "").trim();
  if (!key) {
    return { status: "unavailable", message: "Ninja is not configured (NINJA_SECRET_KEY missing)" };
  }

  try {
    const res = await fetch(`${baseUrl()}/api/identity/identify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idType: "nin",
        mode: "lookup",
        idNumber: nin,
        ...(reference ? { reference: reference.slice(0, 64) } : {}),
      }),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as IdentifyResponse | null;

    // "No record for this number" is a 200 with status not_found, not an
    // error. It is an answer about the customer and must not be reported as
    // an outage, or an admin waits for a retry that will never say anything
    // different.
    if (res.ok && json?.status === "not_found") {
      return { status: "not_found", message: "NIMC has no record for this number" };
    }

    const data = json?.data;

    if (!res.ok || json?.status !== "found" || !data?.first_name || !data?.last_name) {
      const message = json?.message ?? `HTTP ${res.status}`;
      console.error(
        "[ninja] nin verification failed",
        JSON.stringify({
          httpStatus: res.status,
          type: json?.type ?? null,
          code: json?.code ?? null,
          message,
          baseUrl: baseUrl(),
        })
      );
      return { status: "unavailable", message };
    }

    return {
      status: "ok",
      nin: data.id_number ?? nin,
      firstName: data.first_name.trim(),
      lastName: data.last_name.trim(),
      // Empty strings at Basic level. Normalised to undefined so the admin
      // screen shows nothing rather than a blank labelled row.
      dateOfBirth: data.date_of_birth?.trim() || undefined,
      gender: data.gender?.trim() || undefined,
      phoneNumber: data.mobile?.trim() || undefined,
    };
  } catch (err) {
    console.error("[ninja] nin verification error", err);
    return { status: "unavailable", message: "Could not reach Ninja" };
  }
}
