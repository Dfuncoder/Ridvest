/**
 * ADMIN → DEPOSITS — money arriving, and the trail behind each credit.
 *
 * The queue at the top is work to do. The table below it is the audit record:
 * what was credited, to whom, from which account, who approved it and when.
 * A manual deposit carries no amount until it is confirmed, so the figure in
 * the table is always the one an admin read off the bank — never a claim.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DepositActions } from "@/components/admin/DepositActions";
import { getPaymentSettings } from "@/lib/settings";
import { fmtNaira, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Deposits · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

type DepositRow = {
  id: string;
  amount: number | null;
  credited_amount: number | null;
  method: string;
  status: string;
  reference: string;
  admin_note: string | null;
  destination_account: string | null;
  initiator: string | null;
  narration: string | null;
  created_at: string;
  credited_at: string | null;
  user_id: string;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  approver: { full_name: string | null } | null;
};

type BankAccount = {
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  credited: { label: "Credited", cls: "bg-green-500/10 text-green-600 border-green-500/20" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-600 border-red-500/20" },
  pending: { label: "Awaiting payment", cls: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  awaiting_confirmation: {
    label: "Waiting on you",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

export default async function AdminDepositsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data, error }, settings] = await Promise.all([
    admin
      .from("deposits")
      .select(
        "id, amount, credited_amount, method, status, reference, admin_note, destination_account, initiator, narration, created_at, credited_at, user_id, profile:profiles!deposits_user_id_fkey(full_name, email, phone), approver:profiles!deposits_confirmed_by_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    getPaymentSettings(),
  ]);

  if (error) console.error("[admin] deposits query failed", error);

  const rows = (data ?? []) as unknown as DepositRow[];
  const awaiting = rows.filter((d) => d.status === "awaiting_confirmation");
  const settled = rows.filter((d) => d.status !== "awaiting_confirmation");

  // The accounts these users have on file — what the sender name on the bank
  // alert has to match before anything is credited.
  const { data: accountRows } = await admin
    .from("withdrawal_accounts")
    .select("user_id, bank_name, account_number, account_name")
    .in("user_id", awaiting.length > 0 ? awaiting.map((d) => d.user_id) : [""]);

  const accountsByUser = new Map<string, BankAccount[]>();
  for (const a of (accountRows ?? []) as BankAccount[]) {
    accountsByUser.set(a.user_id, [...(accountsByUser.get(a.user_id) ?? []), a]);
  }

  const credited = rows.filter((d) => d.status === "credited");
  const totals = {
    credited: credited.reduce((s, d) => s + Number(d.credited_amount ?? 0), 0),
    manual: credited.filter((d) => d.method === "manual").reduce((s, d) => s + Number(d.credited_amount ?? 0), 0),
    korapay: credited.filter((d) => d.method === "korapay").reduce((s, d) => s + Number(d.credited_amount ?? 0), 0),
    rejected: rows.filter((d) => d.status === "rejected").length,
  };

  const rydvestAccount = `${settings.accountNumber} · ${settings.accountName} · ${settings.bankName}`;

  return (
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Deposits</h1>
            <p className="text-sm text-slate-500 mt-1">
              Check the company account for the money before crediting anyone.
            </p>
          </div>
        </div>

        {/* ── TOTALS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: "Credited in total", value: fmtNaira(totals.credited), tone: "text-slate-900" },
            { label: "By bank transfer", value: fmtNaira(totals.manual), tone: "text-slate-900" },
            { label: "By card / online", value: fmtNaira(totals.korapay), tone: "text-slate-900" },
            { label: "Rejected", value: String(totals.rejected), tone: "text-red-500" },
          ].map((t) => (
            <div
              key={t.label}
              className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 px-4 py-3.5"
            >
              <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{t.label}</p>
              <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
                {t.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── QUEUE ── */}
        <section>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">
            Waiting on you
            {awaiting.length > 0 && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {awaiting.length}
              </span>
            )}
          </h2>

          {awaiting.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-8 text-center">
              <p className="text-sm text-slate-500">Nothing waiting. Every transfer is settled.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {awaiting.map((d) => (
                <div
                  key={d.id}
                  className="bg-white border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-5"
                >
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900">
                      {d.profile?.full_name || "—"}
                    </p>
                    <p className="text-xs text-slate-500">{d.profile?.email || "—"}</p>
                    <p className="text-xs text-slate-500">{d.profile?.phone || "—"}</p>

                    <div className="mt-3">
                      <p className={`${eyebrow} text-slate-400 mb-1.5`}>Sender must match</p>
                      {(accountsByUser.get(d.user_id) ?? []).length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                          No bank account on file — match on the name above.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {(accountsByUser.get(d.user_id) ?? []).map((a) => (
                            <li
                              key={a.account_number}
                              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                            >
                              <span className="font-bold text-slate-900 tabular-nums">
                                {a.account_number}
                              </span>{" "}
                              <span className="text-slate-500">
                                · {a.bank_name} · {a.account_name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <p className="font-mono text-[11px] text-slate-400 mt-2.5 break-all">
                      {d.reference}
                    </p>
                    <p className="text-[11px] text-slate-400">Declared {fmtDateTime(d.created_at)}</p>
                  </div>

                  <DepositActions
                    depositId={d.id}
                    defaultDestination={rydvestAccount}
                    defaultInitiator={d.profile?.full_name ?? ""}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── AUDIT TRAIL ── */}
        <section>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">
            Settled
          </h2>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 overflow-hidden">
            {settled.length === 0 ? (
              <p className="px-5 py-10 text-sm text-slate-500 text-center">Nothing settled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80">
                      <th className={th}>User</th>
                      <th className={`${th} text-right`}>Credited</th>
                      <th className={th}>Method</th>
                      <th className={th}>Paid in from</th>
                      <th className={th}>Into</th>
                      <th className={th}>Narration</th>
                      <th className={th}>Approved by</th>
                      <th className={th}>Settled</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {settled.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className={`${td} min-w-[12rem]`}>
                          <p className="text-sm font-bold text-slate-900">
                            {d.profile?.full_name || "—"}
                          </p>
                          <p className="text-xs text-slate-500">{d.profile?.email || "—"}</p>
                          <p className="font-mono text-[10px] text-slate-400 mt-1 break-all">
                            {d.reference}
                          </p>
                        </td>

                        <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                          {d.credited_amount === null ? (
                            <span className="text-slate-400 font-normal">—</span>
                          ) : (
                            fmtNaira(Number(d.credited_amount))
                          )}
                        </td>

                        <td className={`${td} text-xs text-slate-600 whitespace-nowrap capitalize`}>
                          {d.method === "manual" ? "Bank transfer" : "Card / online"}
                        </td>

                        <td className={`${td} text-xs text-slate-600 min-w-[10rem]`}>
                          {d.initiator || <span className="text-slate-300">—</span>}
                        </td>

                        <td className={`${td} text-xs text-slate-600 min-w-[11rem]`}>
                          {d.destination_account || <span className="text-slate-300">—</span>}
                        </td>

                        <td className={`${td} text-xs text-slate-600 min-w-[11rem]`}>
                          {d.narration || <span className="text-slate-300">—</span>}
                          {d.status === "rejected" && d.admin_note && (
                            <p className="text-xs text-red-600 mt-1">{d.admin_note}</p>
                          )}
                        </td>

                        <td className={`${td} text-xs text-slate-600 whitespace-nowrap`}>
                          {d.approver?.full_name || <span className="text-slate-300">—</span>}
                        </td>

                        <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                          {fmtDateTime(d.credited_at ?? d.created_at)}
                        </td>

                        <td className={`${td} whitespace-nowrap`}>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              (STATUS[d.status] ?? STATUS.pending).cls
                            }`}
                          >
                            {(STATUS[d.status] ?? STATUS.pending).label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <p className="text-xs text-slate-400">
          Showing the 200 most recent deposits. Every credited figure is the amount an admin read
          off the bank account, not an amount the user claimed.
        </p>
      </div>
  );
}
