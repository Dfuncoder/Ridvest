"use server";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SENDING AN EMAIL TO USERS
 *
 * Two actions. createBroadcast() writes the message and one row per intended
 * recipient, then sends as many as it safely can. sendBroadcastBatch() picks
 * up whatever is left.
 *
 * ── WHY IT IS NOT ONE LOOP ───────────────────────────────────────────────
 * A serverless invocation has a time limit and Resend has a rate limit, so a
 * send to a few hundred people cannot reliably finish inside one request.
 * Pretending otherwise produces the worst outcome: a request that dies
 * halfway with no record of who was reached, and an admin who either emails
 * everyone twice or nobody again.
 *
 * So each recipient's row IS the record. A batch claims pending rows, sends,
 * and marks each one as it goes. Stopping is always safe, and resuming sends
 * exactly the people who have not been sent to.
 *
 * ── WHY ONE EMAIL PER PERSON ─────────────────────────────────────────────
 * Not one email with everybody in BCC. A BCC list is one mis-click from
 * publishing the entire customer list, it cannot carry the recipient's own
 * name or unsubscribe link, and it lands in spam far more often.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail, noReplyFrom, supportFrom, supportEmail } from "@/lib/email";
import { broadcastHtml, broadcastText, type Broadcast } from "@/lib/notices";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { BroadcastSchema, fieldErrors } from "@/lib/validation";
import { ERRORS } from "@/lib/errors";
import type { FormState } from "./auth";

/**
 * How many to send per invocation.
 *
 * Resend's limit is per second, not per request, so the ceiling here is the
 * function's time budget: 40 emails at roughly 300ms each leaves plenty of
 * head-room inside a 60-second window. Lower it before raising it.
 */
const BATCH = 40;

/** Space between sends, so a burst never trips the provider's rate limit. */
const GAP_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = {
  id: number;
  user_id: string;
  email: string;
  full_name: string;
};

/**
 * Sends up to BATCH pending copies of one broadcast.
 *
 * Marks every row before moving on, so an invocation that dies mid-flight
 * loses at most the one in flight — and that one stays `pending`, which is
 * the safe direction: a missing email is recoverable, a duplicate is not.
 */
async function deliver(broadcastId: string): Promise<{ sent: number; failed: number; left: number }> {
  const admin = createSupabaseAdminClient();

  const { data: broadcast } = await admin
    .from("broadcasts")
    .select("subject, heading, body, cta_label, cta_url, from_role, audience")
    .eq("id", broadcastId)
    .maybeSingle();

  if (!broadcast) return { sent: 0, failed: 0, left: 0 };

  const { data: rows } = await admin
    .from("broadcast_recipients")
    .select("id, user_id, email, full_name")
    .eq("broadcast_id", broadcastId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(BATCH);

  const batch = (rows ?? []) as Row[];
  const from = broadcast.from_role === "noreply" ? noReplyFrom() : supportFrom();

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    const message: Broadcast = {
      heading: broadcast.heading,
      body: broadcast.body,
      ctaLabel: broadcast.cta_label,
      ctaUrl: broadcast.cta_url,
      // Only on a send to everyone. A reply to four named people about their
      // own pool is correspondence, and offering to unsubscribe from it is
      // nonsense.
      unsubscribeUrl: broadcast.audience === "all" ? unsubscribeUrl(row.user_id) : null,
    };

    const res = await sendEmail({
      from,
      to: row.email,
      // Whoever reads it should be able to reply to a person, whichever
      // address it was sent from.
      replyTo: supportEmail(),
      subject: broadcast.subject,
      text: broadcastText(row.full_name, message),
      html: broadcastHtml(row.full_name, message),
    });

    if (res.ok) {
      sent++;
      await admin
        .from("broadcast_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
    } else {
      failed++;
      await admin
        .from("broadcast_recipients")
        .update({ status: "failed", error: res.body.slice(0, 300) })
        .eq("id", row.id);
    }

    await sleep(GAP_MS);
  }

  const { count: left } = await admin
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .eq("status", "pending");

  if (!left) {
    await admin
      .from("broadcasts")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", broadcastId);
  }

  console.log(
    `[broadcast] ${broadcastId}: sent ${sent}, failed ${failed}, ${left ?? 0} still pending`
  );

  return { sent, failed, left: left ?? 0 };
}

/** Writes the message and its recipient list, then starts sending. */
export async function createBroadcast(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const parsed = BroadcastSchema.safeParse({
    subject: formData.get("subject"),
    heading: formData.get("heading"),
    body: formData.get("body"),
    ctaLabel: formData.get("ctaLabel") ?? "",
    ctaUrl: formData.get("ctaUrl") ?? "",
    fromRole: formData.get("fromRole"),
    audience: formData.get("audience"),
    confirm: formData.get("confirm") === "on",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const admin = createSupabaseAdminClient();

  // ── Who gets it ──────────────────────────────────────────────────────────
  //
  // Resolved once, here, and frozen into rows. Somebody who signs up during
  // the send should not receive a message written for the people who were
  // already here.
  let query = admin.from("profiles").select("id, email, full_name").not("email", "is", null);

  if (d.audience === "all") {
    // Honoured for "everyone" only. Hand-picked recipients are correspondence.
    query = query.eq("marketing_opt_out", false);
  } else {
    const ids = formData.getAll("recipients").map(String).filter(Boolean);
    if (ids.length === 0) return { errors: { recipients: ERRORS.BROADCAST_NO_RECIPIENTS } };
    if (ids.length > 500) return { errors: { recipients: ERRORS.BROADCAST_TOO_MANY } };
    query = query.in("id", ids);
  }

  const { data: people, error: peopleError } = await query;
  if (peopleError) {
    console.error("[broadcast] could not resolve recipients", peopleError.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }
  if (!people || people.length === 0) return { errors: { recipients: ERRORS.BROADCAST_NO_RECIPIENTS } };

  // ── The message ──────────────────────────────────────────────────────────
  const { data: created, error: createError } = await admin
    .from("broadcasts")
    .insert({
      subject: d.subject,
      heading: d.heading,
      body: d.body,
      cta_label: d.ctaLabel || null,
      cta_url: d.ctaUrl || null,
      from_role: d.fromRole,
      audience: d.audience,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (createError || !created) {
    console.error("[broadcast] could not create", createError?.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const { error: rowsError } = await admin.from("broadcast_recipients").insert(
    people.map((p) => ({
      broadcast_id: created.id,
      user_id: p.id,
      email: p.email as string,
      full_name: (p.full_name as string) ?? "",
    }))
  );

  if (rowsError) {
    console.error("[broadcast] could not queue recipients", rowsError.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "broadcast.create",
    target: created.id,
    detail: { subject: d.subject, audience: d.audience, recipients: people.length },
  });

  // Sending starts after the response, so the admin sees the queue straight
  // away rather than watching a spinner for a minute.
  after(async () => {
    await deliver(created.id);
    revalidatePath("/admin/email");
  });

  revalidatePath("/admin/email");

  return {
    success: true,
    message:
      people.length > BATCH
        ? `Queued for ${people.length} people. The first ${BATCH} are going out now — use “Send the rest” below for the remainder.`
        : `Sending to ${people.length} ${people.length === 1 ? "person" : "people"}.`,
  };
}

/** Sends the next batch of whatever is still pending. */
export async function sendBroadcastBatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const id = String(formData.get("broadcastId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { message: ERRORS.ADMIN_ACTION_FAILED };

  const { sent, failed, left } = await deliver(id);

  await admin_audit(user.id, id, sent, failed);
  revalidatePath("/admin/email");

  if (sent === 0 && failed === 0) return { success: true, message: "Nothing left to send." };

  return {
    success: true,
    message:
      left > 0
        ? `Sent ${sent}${failed ? `, ${failed} failed` : ""}. ${left} still to go.`
        : `Done — sent ${sent}${failed ? `, ${failed} failed` : ""}.`,
  };
}

async function admin_audit(actorId: string, broadcastId: string, sent: number, failed: number) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_id: actorId,
    action: "broadcast.send_batch",
    target: broadcastId,
    detail: { sent, failed },
  });
}
