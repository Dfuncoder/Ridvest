/**
 * The receipt emailed to a user once their transfer has been confirmed.
 *
 * Dates and the Rydvest reference come from the deposit row; the destination
 * account, initiator and narration are what the admin recorded at
 * confirmation.
 */
import "server-only";
import { fmtNaira, fmtDateTime } from "./format";

export type Receipt = {
  recipientName: string;
  amount: number;
  reference: string;
  destinationAccount: string;
  initiator: string;
  narration: string;
  initiatedAt: string | Date | null;
  completedAt: string | Date | null;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rows(r: Receipt): Array<[string, string]> {
  return [
    ["Rydvest reference", r.reference],
    ["Destination account", r.destinationAccount || "—"],
    ["Initiated by", r.initiator || r.recipientName || "—"],
    ["Narration", r.narration || "—"],
    ["Date initiated", fmtDateTime(r.initiatedAt)],
    ["Date completed", fmtDateTime(r.completedAt)],
  ];
}

export function receiptSubject(r: Receipt): string {
  return `Transfer successful — ${fmtNaira(r.amount)} added to your balance`;
}

export function receiptText(r: Receipt): string {
  return [
    `Hi ${r.recipientName || "there"},`,
    ``,
    `Your transfer of ${fmtNaira(r.amount)} is successful and has been added to your Rydvest balance.`,
    ``,
    `TRANSACTION DETAILS`,
    ...rows(r).map(([k, v]) => `${k}: ${v}`),
    ``,
    `You can now join a pool from your dashboard.`,
    ``,
    `— Rydvest`,
  ].join("\n");
}

export function receiptHtml(r: Receipt): string {
  const detail = rows(r)
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td style="padding:9px 0;color:#64748b;font-size:13px;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:9px 0 9px 16px;color:#0f172a;font-size:13px;font-weight:600;text-align:right;word-break:break-word">${esc(v)}</td>` +
        `</tr>`
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">

<tr><td style="background:#0d2137;padding:26px 28px">
<p style="margin:0;color:#facc15;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Rydvest</p>
</td></tr>

<tr><td style="padding:28px" align="center">
<div style="width:52px;height:52px;line-height:52px;border-radius:26px;background:#dcfce7;color:#16a34a;font-size:26px;margin:0 auto 14px">&#10003;</div>
<p style="margin:0 0 4px;color:#64748b;font-size:14px">Transfer successful</p>
<p style="margin:0;color:#0f172a;font-size:30px;font-weight:800">${esc(fmtNaira(r.amount))}</p>
<p style="margin:10px 0 0;color:#64748b;font-size:14px;line-height:1.6">
Hi ${esc(r.recipientName || "there")}, this has been added to your Rydvest balance.
</p>
</td></tr>

<tr><td style="padding:0 28px 8px">
<p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Transaction details</p>
<table role="presentation" width="100%" style="border-top:1px solid #f1f5f9" cellpadding="0" cellspacing="0">
${detail}
</table>
</td></tr>

<tr><td style="padding:20px 28px 28px">
<p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">Keep this receipt for your records.</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}
