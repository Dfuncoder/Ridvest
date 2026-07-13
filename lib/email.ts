/**
 * Email sending via Resend's REST API — SERVER ONLY.
 *
 * Address roles (all configurable in .env):
 *   CONTACT_FROM  — the no-reply sender used for internal notifications
 *                   (e.g. "new contact message" alerts to the support inbox).
 *   CONTACT_EMAIL — the support inbox. Notifications are delivered TO it,
 *                   and admin replies to customers are sent FROM it, so
 *                   customer follow-ups come back to the same inbox.
 *
 * Requires RESEND_API_KEY; the domain in the from-address must be verified
 * at resend.com/domains.
 */
import "server-only";

export type SendEmailResult = { ok: boolean; status: number; body: string };

export async function sendEmail(params: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, body: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "rydvest/1.0",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        reply_to: params.replyTo,
        subject: params.subject,
        text: params.text,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`[email] Resend REJECTED — HTTP ${res.status}: ${body}`);
    } else {
      console.log(`[email] Resend accepted: ${body}`);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error("[email] Resend network error", err);
    return { ok: false, status: 0, body: String(err) };
  }
}

/** The support inbox address (recipient of notifications, sender of replies). */
export function supportEmail(): string {
  return process.env.CONTACT_EMAIL || "support@rydvest.com";
}

/** The no-reply sender used for internal notifications. */
export function noReplyFrom(): string {
  return process.env.CONTACT_FROM || "Rydvest Contact <onboarding@resend.dev>";
}

/** The sender identity for replies to customers — the support inbox itself. */
export function supportFrom(): string {
  return `Rydvest Support <${supportEmail()}>`;
}
