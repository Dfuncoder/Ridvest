"use server";

/**
 * CONTACT FORM — server action.
 *
 * Two-layer delivery so no message is ever lost:
 *   1. ALWAYS saved to the contact_messages table (visible in the admin
 *      dashboard under "Messages").
 *   2. ALSO emailed to CONTACT_EMAIL (default support@rydvest.com) via
 *      Resend — but only when RESEND_API_KEY is configured. If it isn't,
 *      the form still works and messages simply live in the admin dashboard.
 *
 * Spam defense: a hidden "website" honeypot field (bots fill it, humans
 * can't see it) plus server-side Zod validation and length caps.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail, noReplyFrom, supportEmail } from "@/lib/email";
import { ERRORS } from "@/lib/errors";
import { ContactSchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "./auth";

/**
 * Notifies the support inbox about a new message. Non-fatal on failure —
 * the message is already stored, and the full Resend response is logged
 * (dev terminal locally, Project → Logs on Vercel).
 */
async function sendContactEmail(data: { name: string; email: string; phone: string; message: string }) {
  await sendEmail({
    from: noReplyFrom(),
    to: supportEmail(),
    replyTo: data.email, // hitting "Reply" in the support inbox answers the sender
    subject: `New contact message from ${data.name}`,
    text: [
      `Name:  ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone || "—"}`,
      ``,
      data.message,
    ].join("\n"),
  });
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
  const { error } = await admin.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
  });

  if (error) {
    console.error("[contact] insert failed", error);
    return { message: ERRORS.CONTACT_FAILED };
  }

  // 2. Notify by email (best-effort).
  await sendContactEmail(parsed.data);

  return {
    success: true,
    message: "Thanks! Your message has been sent — we'll get back to you within one business day.",
  };
}
