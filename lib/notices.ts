/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCOUNT NOTICES — the emails that tell somebody something changed.
 *
 * Four of them, and they do different jobs:
 *
 *   • Verification approved — good news, and what it unlocks.
 *   • Verification not approved — the reason, in the admin's own words, and
 *     what to do next. A rejection without a reason just makes people guess
 *     and resubmit the same thing.
 *   • New sign-in — where it happened and on what, so somebody recognises
 *     their own phone at a glance and raises the alarm when it is not theirs.
 *   • Admin sign-in — the same details, sent to the notification list rather
 *     than to the admin who signed in.
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

// ─────────────────────────────────────────────────────────────────────────────
// NEW SIGN-IN
//
// Sent to the address that just signed in. Its whole job is to let somebody
// say "that was not me" while it still matters, so the four lines that
// identify the session come first and the warning is the last thing read.
//
// None of these details prove anything — they are read off the request and a
// determined person can dress them up. They earn their place because somebody
// recognises their own phone and their own city instantly, and that is enough
// to spot a stranger.
// ─────────────────────────────────────────────────────────────────────────────

export type SignIn = {
  /** When it happened. */
  at: Date;
  ip: string | null;
  location: string | null;
  device: string;
};

/**
 * Lagos time, said out loud.
 *
 * The server runs on UTC, and "2:45 am" is the single most useful thing in
 * this email — an hour out and somebody shrugs at a sign-in they should be
 * alarmed by. The zone is named so there is nothing to work out.
 */
function whenWAT(at: Date): string {
  const stamp = at.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${stamp} (WAT)`;
}

/** Anything we could not read says so rather than leaving a blank row. */
function signInRows(s: SignIn): Array<[string, string]> {
  return [
    ["When", whenWAT(s.at)],
    ["Device", s.device],
    ["Location", s.location ?? "Not available"],
    ["IP address", s.ip ?? "Not available"],
  ];
}

/** Label/value table in the receipt style. */
function detailTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td style="padding:9px 0;color:#64748b;font-size:13px;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:9px 0 9px 16px;color:#0f172a;font-size:13px;font-weight:600;text-align:right;word-break:break-word">${esc(v)}</td>` +
        `</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-top:1px solid #f1f5f9" cellpadding="0" cellspacing="0">${body}</table>`;
}

export const loginNoticeSubject = "New sign-in to your Rydvest account";

export function loginNoticeText(name: string, s: SignIn): string {
  return [
    `Hi ${firstName(name)},`,
    ``,
    `Your Rydvest account was just signed in to.`,
    ``,
    `SIGN-IN DETAILS`,
    ...signInRows(s).map(([k, v]) => `${k}: ${v}`),
    ``,
    `If this was you, there is nothing to do.`,
    ``,
    `If it was not, change your password straight away and email ${supportEmail()}`,
    `so we can secure your account.`,
    ``,
    `${site()}/forgot-password`,
    ``,
    `Rydvest`,
  ].join("\n");
}

export function loginNoticeHtml(name: string, s: SignIn): string {
  return wrap(
    `<tr><td style="padding:30px 28px 4px" align="center">
<div style="width:52px;height:52px;line-height:52px;border-radius:26px;background:#e0f2fe;color:#0369a1;font-size:24px;margin:0 auto 14px">&#128274;</div>
<p style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:800">New sign-in to your account</p>
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
Hi ${esc(firstName(name))}, your Rydvest account was just signed in to.
</p>
</td></tr>

<tr><td style="padding:22px 28px 8px">
<p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Sign-in details</p>
${detailTable(signInRows(s))}
</td></tr>

<tr><td style="padding:14px 28px 0">
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.65">
If this was you, there is nothing to do.
</p>
</td></tr>

<tr><td style="padding:16px 28px 0">
<table role="presentation" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px 18px">
<p style="margin:0 0 6px;color:#991b1b;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">If it wasn't you</p>
<p style="margin:0 0 14px;color:#7f1d1d;font-size:14px;line-height:1.65">
Change your password straight away, then email us so we can secure your account.
</p>
<a href="${esc(`${site()}/forgot-password`)}" style="display:block;padding:13px 18px;background:#dc2626;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;border-radius:10px;text-align:center">Change my password</a>
</td></tr></table>
</td></tr>`,
    helpLine("Questions about this sign-in, reply to this email or contact")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SIGN-IN — to the notification list, not to the admin who signed in
//
// An admin session can read verification documents, move money and lock
// accounts, so every one of them is announced to the whole list. The point is
// that the other admins see it: a sign-in nobody in the room started is the
// first sign of a stolen admin account, and the person holding it will not be
// forwarding their own alert.
// ─────────────────────────────────────────────────────────────────────────────

export function adminLoginAlertSubject(name: string): string {
  return `Admin sign-in — ${name}`;
}

/** Same session details, plus which account it was. */
function adminRows(account: string, s: SignIn): Array<[string, string]> {
  return [["Account", account], ...signInRows(s)];
}

export function adminLoginAlertText(account: string, s: SignIn): string {
  return [
    `An admin signed in to the Rydvest console.`,
    ``,
    ...adminRows(account, s).map(([k, v]) => `${k}: ${v}`),
    ``,
    `If this sign-in was not expected, lock the account and change its password now.`,
    ``,
    `${site()}/admin/users`,
    ``,
    `Rydvest`,
  ].join("\n");
}

export function adminLoginAlertHtml(account: string, s: SignIn): string {
  return wrap(
    `<tr><td style="padding:30px 28px 4px">
<p style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:800">Admin sign-in</p>
<p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
An admin account signed in to the console.
</p>
</td></tr>

<tr><td style="padding:22px 28px 8px">
<p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Session</p>
${detailTable(adminRows(account, s))}
</td></tr>

<tr><td style="padding:16px 28px 0">
<table role="presentation" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px 18px">
<p style="margin:0;color:#854d0e;font-size:14px;line-height:1.65">
If this sign-in was not expected, lock the account and change its password now.
</p>
</td></tr></table>
${button(`${site()}/admin/users`, "Open admin users")}
</td></tr>`,
    helpLine("This alert goes to the Rydvest notification list. Questions, contact")
  );
}
