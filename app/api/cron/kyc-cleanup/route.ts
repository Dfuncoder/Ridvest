/**
 * Keeps the private 'kyc' storage bucket from growing for ever.
 *
 * Removes two kinds of image, and nothing else:
 *
 *   1. ORPHANS — objects in the bucket that no submission row points at. The
 *      selfie is uploaded before the row is written, so a failed insert leaves
 *      one behind. Only orphans older than ORPHAN_GRACE_HOURS are touched, so
 *      an upload that is mid-submission right now is never pulled out from
 *      under it.
 *
 *   2. EXPIRED ATTEMPTS — selfies on rejected submissions past the retention
 *      window, and on attempts superseded by an approval. Which rows those are
 *      is decided in SQL (expired_kyc_selfies), not here.
 *
 * An APPROVED submission keeps its photo, and no submission ROW is ever
 * deleted: the row is the audit trail of who was verified and by whom.
 *
 * Called on a schedule (see vercel.json), authenticated the same way as the
 * payouts cron. Safe to run repeatedly — everything it does is idempotent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
/** Deleting images is slow; give it more than the default budget. */
export const maxDuration = 60;

/** How long an unreferenced object is left alone, in case it is in flight. */
const ORPHAN_GRACE_HOURS = 24;
/** Supabase accepts a limited batch per remove() call. */
const DELETE_BATCH = 100;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run the KYC cleanup");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const removed: string[] = [];

  // ── 0. The protected set ─────────────────────────────────────────────────
  //
  // Every approved submission's photo, fetched up front and used to filter
  // BOTH passes below. expired_kyc_selfies() already excludes approved rows;
  // this is a second, independent guard, because an approved selfie is the
  // evidence that a verification happened and losing one is unrecoverable.
  // Deleting one would require this and that filter to be wrong at once.
  const { data: approved, error: approvedError } = await admin.rpc("approved_kyc_selfies");

  if (approvedError) {
    console.error("[cron] approved_kyc_selfies failed", approvedError.message);
    // Refuse to delete anything rather than run without the safety net.
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const protectedPaths = new Set(
    ((approved ?? []) as Array<{ selfie_path: string }>).map((r) => r.selfie_path)
  );

  // ── 1. Expired attempts ──────────────────────────────────────────────────
  const { data: expired, error: expiredError } = await admin.rpc("expired_kyc_selfies");

  if (expiredError) {
    console.error("[cron] expired_kyc_selfies failed", expiredError.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const expiredRows = ((expired ?? []) as Array<{ id: string; selfie_path: string }>).filter(
    (r) => {
      if (!protectedPaths.has(r.selfie_path)) return true;
      // Should be impossible. If it ever happens, something is wrong with the
      // query and it needs to be loud rather than silently destructive.
      console.error("[cron] REFUSED to delete an approved selfie", r.selfie_path);
      return false;
    }
  );

  for (let i = 0; i < expiredRows.length; i += DELETE_BATCH) {
    const batch = expiredRows.slice(i, i + DELETE_BATCH);
    const { error } = await admin.storage.from("kyc").remove(batch.map((r) => r.selfie_path));

    if (error) {
      console.error("[cron] kyc selfie removal failed", error.message);
      continue; // Leave them marked undeleted; the next run tries again.
    }

    // Only marked once the object is actually gone, so a failed delete is
    // retried rather than quietly forgotten.
    const { error: markError } = await admin.rpc("mark_kyc_selfie_deleted", {
      p_ids: batch.map((r) => r.id),
    });
    if (markError) console.error("[cron] mark_kyc_selfie_deleted failed", markError.message);

    removed.push(...batch.map((r) => r.selfie_path));
  }

  // ── 2. Orphans ───────────────────────────────────────────────────────────
  const { data: referenced, error: refError } = await admin.rpc("referenced_kyc_selfies");

  if (refError) {
    console.error("[cron] referenced_kyc_selfies failed", refError.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const live = new Set(
    ((referenced ?? []) as Array<{ selfie_path: string }>).map((r) => r.selfie_path)
  );
  const cutoff = Date.now() - ORPHAN_GRACE_HOURS * 3600_000;

  // Objects are stored as <user-id>/<timestamp>.jpg, so walk the folders.
  const { data: folders } = await admin.storage.from("kyc").list("", { limit: 1000 });
  const orphans: string[] = [];

  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from("kyc").list(folder.name, { limit: 1000 });

    for (const file of files ?? []) {
      const path = `${folder.name}/${file.name}`;
      if (live.has(path)) continue;
      // Same safety net on the orphan pass.
      if (protectedPaths.has(path)) continue;

      const created = file.created_at ? new Date(file.created_at).getTime() : 0;
      // Unknown age counts as new, so nothing is deleted on a guess.
      if (!created || created > cutoff) continue;

      orphans.push(path);
    }
  }

  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    const batch = orphans.slice(i, i + DELETE_BATCH);
    const { error } = await admin.storage.from("kyc").remove(batch);
    if (error) {
      console.error("[cron] orphan removal failed", error.message);
      continue;
    }
    removed.push(...batch);
  }

  // Sign-in history ages out here too — same nightly slot, same reason. An IP
  // address is personal data, and ninety days is long enough to settle a
  // dispute without quietly keeping a movement history of every customer.
  const { data: expiredSignIns, error: signInError } = await admin.rpc("expire_sign_in_events");
  if (signInError) console.error("[cron] sign-in history purge failed", signInError.message);
  const purged = (expiredSignIns as { deleted?: number } | null)?.deleted ?? 0;

  console.log(
    `[cron] kyc cleanup: ${expiredRows.length} expired, ${orphans.length} orphaned, ${removed.length} removed; sign-in history purged ${purged}`
  );

  return NextResponse.json({
    ok: true,
    expired: expiredRows.length,
    orphaned: orphans.length,
    removed: removed.length,
    signInEventsPurged: purged,
  });
}
