"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IDENTITY VERIFICATION — server actions.
 *
 * A user sends an NIN or BVN and a photo of their face taken on camera. An
 * admin looks at both and decides. Until that decision is "approved",
 * request_withdrawal() in the database refuses to create a withdrawal, so the
 * rule holds even if a UI check were bypassed.
 *
 * The photo never becomes a public URL: it goes into the private 'kyc' bucket
 * and the admin screen fetches a short-lived signed link when it renders.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail, noReplyFrom } from "@/lib/email";
import { getPaymentSettings, getNinProvider } from "@/lib/settings";
import { encryptSecret } from "@/lib/crypto";
import { verifyNin } from "@/lib/nin";
import { namesMatch } from "@/lib/names";
import { ERRORS } from "@/lib/errors";
import { KycSubmissionSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

/**
 * A selfie from the capture component is a ~900px JPEG, which lands between
 * 40KB and 250KB. The ceiling is well under the 1MB Server Action body limit
 * so a submission cannot be rejected by the framework before we see it.
 */
const MAX_SELFIE_BYTES = 800_000;
const MIN_SELFIE_BYTES = 4_000;

/** True when the bytes really do start with a JPEG SOI marker. */
function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function submitKyc(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  // ── Already sorted, or already waiting? ──────────────────────────────────
  const [{ data: existing }, { data: profile }] = await Promise.all([
    admin
      .from("kyc_submissions")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"]),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (existing?.some((r) => r.status === "approved")) {
    return { message: ERRORS.KYC_ALREADY_APPROVED };
  }
  if (existing?.some((r) => r.status === "pending")) {
    return { message: ERRORS.KYC_ALREADY_PENDING };
  }

  // ── The typed fields ─────────────────────────────────────────────────────
  const parsed = KycSubmissionSchema.safeParse({
    idNumber: formData.get("idNumber"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // ── The photo ────────────────────────────────────────────────────────────
  const selfie = formData.get("selfie");
  if (!(selfie instanceof File) || selfie.size === 0) {
    return { errors: { selfie: ERRORS.KYC_SELFIE_REQUIRED } };
  }
  if (selfie.size < MIN_SELFIE_BYTES || selfie.size > MAX_SELFIE_BYTES) {
    return { errors: { selfie: ERRORS.KYC_SELFIE_INVALID } };
  }

  const bytes = new Uint8Array(await selfie.arrayBuffer());
  // Check the bytes, not the declared type: a client can claim any MIME it
  // likes, and this bucket should only ever hold photographs.
  if (!looksLikeJpeg(bytes)) {
    return { errors: { selfie: ERRORS.KYC_SELFIE_INVALID } };
  }

  // ── Encrypt the number before anything is written anywhere.
  //
  // Done up front so a missing or malformed key fails the submission cleanly,
  // rather than after a photo has already been stored. The user gets the
  // generic message; the operator gets the real reason in the logs, because
  // only they can fix it.
  const idNumber = parsed.data.idNumber;
  let idNumberEncrypted: string;
  try {
    idNumberEncrypted = encryptSecret(idNumber, user.id);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[kyc] cannot encrypt ID number —", detail);
    return { message: ERRORS.KYC_SUBMIT_FAILED };
  }

  // ── Store the photo first; a row without its image is worse than the
  //    reverse, which just leaves an orphan object nobody can reach. ───────
  const path = `${user.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("kyc")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    console.error("[kyc] selfie upload failed", uploadError);
    return { message: ERRORS.KYC_SUBMIT_FAILED };
  }

  const { data: inserted, error: insertError } = await admin
    .from("kyc_submissions")
    .insert({
      user_id: user.id,
      id_type: "nin",
      id_number_encrypted: idNumberEncrypted,
      id_number_last4: idNumber.slice(-4),
      selfie_path: path,
      // The NIMC lookup starts as soon as the response is on its way.
      // lookup_at marks when it STARTED, so a check that never finishes can
      // be spotted as stale and run again.
      lookup_status: "checking",
      lookup_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    // Don't leave the orphan behind.
    await admin.storage.from("kyc").remove([path]);

    // 23505 here means the one-pending-per-user index caught a double submit
    // that slipped past the check above — a double-click, usually.
    if (insertError.code === "23505") {
      return { message: ERRORS.KYC_ALREADY_PENDING };
    }
    console.error("[kyc] insert failed", insertError);
    return { message: ERRORS.KYC_SUBMIT_FAILED };
  }

  revalidatePath("/dashboard/verify");
  revalidatePath("/dashboard/payouts");
  revalidatePath("/admin/kyc");

  // Run the NIMC lookup and tell the admins, once the user has their answer.
  // Neither should hold up the response: the lookup is a call to Monnify and
  // the email is a call to Resend, and the user only needs to know we have it.
  after(async () => {
    await runNinLookup(inserted.id, user.id, idNumber, profile?.full_name ?? "");
    await notifyAdmins({
      submissionId: inserted.id,
      name: profile?.full_name || user.email,
    });
  });

  return {
    success: true,
    message: "Sent. We'll email you as soon as your identity has been confirmed.",
  };
}

/**
 * Asks NIMC (through Monnify) who the NIN belongs to, and records the answer
 * against the submission.
 *
 * The comparison is ours: Monnify is sent the number alone and never told what
 * name to expect, so it cannot be led into agreeing with one. namesMatch() is
 * the same token comparison used for bank account names, which tolerates
 * middle names and ordering the way Nigerian records actually vary.
 *
 * Exported so an admin can re-run a check that failed — a flat Monnify wallet
 * should not mean a user has to submit everything again.
 */
export async function runNinLookup(
  submissionId: string,
  userId: string,
  nin: string,
  profileName: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Whichever provider the admin has selected. Recorded with the result, so a
  // row that failed six weeks ago still says who was asked.
  const provider = await getNinProvider();
  const result = await verifyNin(nin, provider);

  if (result.status !== "ok") {
    await admin
      .from("kyc_submissions")
      .update({
        lookup_status: result.status === "not_found" ? "not_found" : "failed",
        lookup_error: `[${provider}] ${result.message}`.slice(0, 300),
        lookup_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
    revalidatePath("/admin/kyc");
    revalidatePath("/dashboard/verify");
    return;
  }

  const nimcName = `${result.firstName} ${result.lastName}`.trim();
  const matched = namesMatch(nimcName, profileName);

  await admin
    .from("kyc_submissions")
    .update({
      lookup_status: matched ? "matched" : "mismatch",
      lookup_first_name: result.firstName,
      lookup_last_name: result.lastName,
      lookup_dob: result.dateOfBirth ?? null,
      lookup_gender: result.gender ?? null,
      lookup_phone: result.phoneNumber ?? null,
      lookup_error: null,
      lookup_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (!matched) {
    console.warn(
      "[kyc] NIN name does not match profile",
      JSON.stringify({ submissionId, userId })
    );
  }

  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/verify");
}

/** Lets the admin list know a verification is waiting, with a link to it. */
async function notifyAdmins(params: { submissionId: string; name: string }) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const link = `${site}/admin/kyc`;
  const { notifyEmails } = await getPaymentSettings();

  const text = [
    `${params.name} submitted an NIN and a selfie for verification.`,
    ``,
    `Review it here:`,
    link,
  ].join("\n");

  for (const to of notifyEmails) {
    const res = await sendEmail({
      from: noReplyFrom(),
      to,
      subject: `Verification to review — ${params.name}`,
      text,
    });
    if (!res.ok) console.error("[kyc] admin notify failed for", to, res.body);
  }
}
