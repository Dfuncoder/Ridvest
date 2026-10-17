/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCOUNT NOTICES — the emails that tell somebody something changed.
 *
 * Two of them, and they do different jobs:
 *
 *   • Verification approved — good news, and what it unlocks.
 *   • Verification not approved — the reason, in the admin's own words, and
 *     what to do next. A rejection without a reason just makes people guess
 *     and resubmit the same thing.
 *
 * The password-change notice is NOT here: Supabase sends that one itself as a
 * security notification, so it covers every path a password can change by.
 * See supabase/email-templates/password-changed.html.
 *
 * Every one carries a plain-text part as well as HTML: some clients render
 * nothing else, and an email about account security is the worst one to
 * arrive blank.
 *
 * House style matches lib/receipt.ts — navy bar, amber wordmark, 520px card,
 * tables and inline styles because email clients do not do layout.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { supportEmail } from "./email";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

function site(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

/** Shell: brand bar, body, support footer. */
function wrap(inner: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">

<tr><td style="background:#0d2137;padding:26px 28px">
<p style="margin:0;color:#facc15;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Rydvest</p>
</td></tr>

${inner}

<tr><td style="padding:20px 28px 28px;border-top:1px solid #f1f5f9">
<p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">${footer}</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
<a href="${esc(href)}" style="display:block;padding:15px 20px;background:#facc15;color:#0d2137;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;text-align:center">${esc(label)}</a>
</td></tr></table>`;
}

const helpLine = (lead: string) =>
  `${lead} <a href="mailto:${esc(supportEmail())}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(supportEmail())}</a>.`;

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION APPROVED
// ─────────────────────────────────────────────────────────────────────────────

export const kycApprovedSubject = "Your Rydvest account is verified";

export function kycApprovedText(name: string): string {
  return [
    `Hi ${firstName(name)},`,
    ``,
    `Your identity has been confirmed and your Rydvest account is now verified.`,
    ``,
    `You can now withdraw to your bank account and send money to other Rydvest accounts.`,
    ``,
    `${site()}/dashboard/payouts`,
    ``,
    `Rydvest`,
  ].join("\n");
}

export function kycApprovedHtml(name: string): string {
  return wrap(
    `<tr><td style="padding:30px 28px 4px" align="center">
<div style="width:52px;height:52px;line-height:52px;border-radius:26px;background:#dcfce7;color:#16a34a;font-size:26px;margin:0 auto 14px">&#10003;</div>
<p style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:800">You're verified</p>
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
Hi ${esc(firstName(name))}, your identity has been confirmed.
</p>
</td></tr>

<tr><td style="padding:22px 28px 0">
<table role="presentation" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px 18px">
<p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Now available to you</p>
<p style="margin:0;color:#0f172a;font-size:14px;line-height:1.7">
&bull; Withdraw to a bank account in your name<br />
&bull; Send money to other Rydvest accounts
</p>
</td></tr></table>
${button(`${site()}/dashboard/payouts`, "Go to my dashboard")}
</td></tr>`,
    helpLine("Any questions, reply to this email or contact")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION NOT APPROVED
//
// The reason is the entire point of this email. It is the admin's own words,
// shown verbatim, because a generic "declined" leaves somebody resubmitting
// the same photo over and over.
// ─────────────────────────────────────────────────────────────────────────────

export const kycRejectedSubject = "About your Rydvest verification";

export function kycRejectedText(name: string, reason: string): string {
  return [
    `Hi ${firstName(name)},`,
    ``,
    `We could not confirm your identity from what you sent.`,
    ``,
    `Reason: ${reason}`,
    ``,
    `You can submit again once that is sorted — nothing else on your account has changed.`,
    ``,
    `${site()}/dashboard/verify`,
    ``,
    `If you think this is a mistake, reply to this email.`,
    ``,
    `Rydvest`,
  ].join("\n");
}

export function kycRejectedHtml(name: string, reason: string): string {
  return wrap(
    `<tr><td style="padding:30px 28px 4px">
<p style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:800">We couldn't verify your identity</p>
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
Hi ${esc(firstName(name))}, we were not able to confirm your identity from what you sent.
</p>
</td></tr>

<tr><td style="padding:20px 28px 0">
<table role="presentation" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px 18px">
<p style="margin:0 0 6px;color:#991b1b;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Reason</p>
<p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.65">${esc(reason)}</p>
</td></tr></table>

<p style="margin:18px 0 0;color:#64748b;font-size:14px;line-height:1.65">
You can submit again once that is sorted. Nothing else on your account has changed.
</p>
${button(`${site()}/dashboard/verify`, "Submit again")}
</td></tr>`,
    helpLine("If you think this is a mistake, reply to this email or contact")
  );
}
