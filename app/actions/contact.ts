"use server";

/**
 * CONTACT FORM — server action.
 *
 * Two-layer delivery so no message is ever lost:
 *   1. ALWAYS saved to the contact_messages table (visible in the admin
 *      dashboard under "Messages").
 *   2. ALSO emailed to everyone on the admin notification list (the same
 *      list that gets transfer alerts, set at /admin/settings) with a button
 *      straight to the message. Only when RESEND_API_KEY is configured — if it
 *      isn't, the form still works and messages live in the dashboard.
 *
 * Spam defense: a hidden "website" honeypot field (bots fill it, humans
 * can't see it) plus server-side Zod validation and length caps.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { sendEmail, noReplyFrom } from "@/lib/email";
import { getPaymentSettings } from "@/lib/settings";
import { ERRORS } from "@/lib/errors";
import { ContactSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tells the admins a message has arrived, with a button that opens it.
 *
 * Goes to the whole notification list rather than one inbox, so a message does
 * not sit unread because one person is away. Non-fatal on failure: the message
 * is already stored, and the Resend response is logged.
 */
async function sendContactEmail(
  messageId: string,
  data: { name: string; email: string; phone: string; message: string }
) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const link = `${site}/admin/messages/${messageId}`;
  const { notifyEmails } = await getPaymentSettings();

  const text = [
    `${data.name} sent a message through the website.`,
    ``,
    `Name:  ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone || "—"}`,
    ``,
    data.message,
    ``,
    `Reply here:`,
    link,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">New message</p>
<h1 style="margin:0 0 18px;color:#0f172a;font-size:22px;font-weight:800">${escapeHtml(data.name)}</h1>
<table role="presentation" width="100%" style="border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin-bottom:18px" cellpadding="0" cellspacing="0">
<tr><td style="padding:6px 0;color:#64748b;font-size:14px">Email</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right">${escapeHtml(data.email)}</td></tr>
<tr><td style="padding:6px 0;color:#64748b;font-size:14px">Phone</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right">${escapeHtml(data.phone || "—")}</td></tr>
</table>
<p style="margin:0 0 22px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.message)}</p>
<a href="${link}" style="display:block;text-align:center;padding:14px 20px;background:#facc15;color:#0d2137;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px">Open and reply</a>
</td></tr></table>
</td></tr></table>
</body></html>`;

  for (const to of notifyEmails) {
    const res = await sendEmail({
      from: noReplyFrom(),
      to,
      // Hitting reply in the inbox answers the sender directly, for anyone who
      // would rather not open the dashboard.
      replyTo: data.email,
      subject: `New message from ${data.name}`,
      text,
      html,
    });
    if (!res.ok) console.error("[contact] notify failed for", to, res.body);
  }
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  // Honeypot: real users never see this field; bots auto-fill it.
  // Pretend success so the bot moves on.
  if (String(formData.get("website") ?? "") !== "") {
    return { success: true, message: "Thanks! We'll get back to you shortly." };
  }

  const parsed = ContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // 1. Persist — the source of truth (shown in /admin/messages).
  const admin = createSupabaseAdminClient();
  const { data: inserted, error } = await admin
    .from("contact_messages")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      message: parsed.data.message,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[contact] insert failed", error);
    return { message: ERRORS.CONTACT_FAILED };
  }

  // 2. Notify by email (best-effort) — after the response is on its way, so
  //    the sender is not kept waiting on Resend.
  if (inserted?.id) {
    const id = inserted.id;
    after(async () => {
      await sendContactEmail(id, parsed.data);
    });
  }

  return {
    success: true,
    message: "Thanks! Your message has been sent — we'll get back to you within one business day.",
  };
}
