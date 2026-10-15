/**
 * ADMIN → WITHDRAWALS — money leaving the platform.
 *
 * The queue at the top is work: each request shows the destination account and
 * whether its holder name matches the profile, which is the last human check
 * before a transfer is sent. The table below is the record — what was paid, to
 * which account, and which admin approved and sent it.
 *
 * The name check uses the same rule as the database (lib/names.ts). A local
 * copy here once compared the two strings exactly, so it flagged accounts
 * request_withdrawal() was perfectly happy with.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { approveWithdrawal, markWithdrawalPaid, rejectWithdrawal } from "@/app/actions/admin";
import { namesMatch } from "@/lib/names";
import { fmtNaira, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Withdrawals · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  approved: { label: "Approved", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  paid: { label: "Paid", cls: "bg-green-500/10 text-green-600 border-green-500/20" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
};

type Row = {
  id: string;
  amount: number;
  status: string;
  admin_note: string | null;
  requested_at: string;
  approved_at: string | null;
  processed_at: string | null;
  user: { full_name: string | null; email: string | null; phone: string | null } | null;
  account: { bank_name: string; account_number: string; account_name: string } | null;
  approver: { full_name: string | null } | null;
  processor: { full_name: string | null } | null;
};

// withdrawals points at profiles three times now (user_id, approved_by,
// processed_by), so every embed has to name its foreign key.
const SELECT =
  "id, amount, status, admin_note, requested_at, approved_at, processed_at, " +
  "user:profiles!withdrawals_user_id_fkey(full_name, email, phone), " +
  "account:withdrawal_accounts(bank_name, account_number, account_name), " +
  "approver:profiles!withdrawals_approved_by_fkey(full_name), " +
  "processor:profiles!withdrawals_processed_by_fkey(full_name)";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("withdrawals")
    .select(SELECT)
    .order("requested_at", { ascending: false })
    .limit(200);

  // Until migrate-withdrawal-audit.sql has run, approved_by and processed_by do
  // not exist and this query fails outright. Say so rather than rendering an
  // empty page that reads as "no withdrawals".
  if (error) console.error("[admin] withdrawals query failed", error);

  const rows = (data ?? []) as unknown as Row[];
  const open = rows.filter((w) => w.status === "pending" || w.status === "approved");
  const closed = rows.filter((w) => w.status === "paid" || w.status === "rejected");

  const sum = (f: (r: Row) => boolean) =>
    rows.filter(f).reduce((s, r) => s + Number(r.amount), 0);

  const totals = {
    pending: sum((r) => r.status === "pending"),
    approved: sum((r) => r.status === "approved"),
    paid: sum((r) => r.status === "paid"),
    rejected: sum((r) => r.status === "rejected"),
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Withdrawals</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send the bank transfer yourself, then mark it paid here. Rejecting returns the money to
          the user&apos;s balance.
        </p>
      </div>

      {/* ── TOTALS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "Awaiting review", value: fmtNaira(totals.pending), tone: "text-amber-600" },
          { label: "Approved, not sent", value: fmtNaira(totals.approved), tone: "text-blue-600" },
          { label: "Paid out", value: fmtNaira(totals.paid), tone: "text-green-600" },
          { label: "Rejected", value: fmtNaira(totals.rejected), tone: "text-slate-400" },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── QUEUE ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">
          Needs action
          {open.length > 0 && (
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {open.length}
            </span>
          )}
        </h2>

        {open.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-500">No open withdrawal requests.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((w) => {
              const match = namesMatch(w.account?.account_name ?? "", w.user?.full_name ?? "");
              return (
                <Card
                  key={w.id}
                  className={`p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-5 ${
                    match ? "" : "border-red-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                        {fmtNaira(w.amount)}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          (STATUS[w.status] ?? STATUS.pending).cls
                        }`}
                      >
                        {(STATUS[w.status] ?? STATUS.pending).label}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-700 mt-1.5">
                      {w.user?.full_name || "—"}
                    </p>
                    <p className="text-xs text-slate-500">{w.user?.email || "—"}</p>
                    <p className="text-xs text-slate-500">{w.user?.phone || "—"}</p>

                    <div className="mt-3 rounded-xl border px-3.5 py-3 bg-slate-50/80 border-slate-200">
                      <p className={`${eyebrow} text-slate-400 mb-1.5`}>Send to</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {w.account?.account_number || "—"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {w.account?.account_name || "—"} · {w.account?.bank_name || "—"}
                      </p>

                      <p
                        className={`flex items-center gap-1.5 text-[11px] font-bold mt-2 ${
                          match ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                          {match ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          )}
                        </svg>
                        {match
                          ? "Account name matches the profile"
                          : "Account name does NOT match the profile — do not send"}
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2.5">
                      Requested {fmtDateTime(w.requested_at)}
                      {w.approver?.full_name && (
                        <>
                          {" · approved by "}
                          <span className="font-semibold text-slate-600">
                            {w.approver.full_name}
                          </span>
                          {w.approved_at && ` on ${fmtDateTime(w.approved_at)}`}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 lg:w-56 shrink-0">
                    {w.status === "pending" && (
                      <form action={approveWithdrawal}>
                        <input type="hidden" name="withdrawalId" value={w.id} />
                        <button
                          type="submit"
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150"
                        >
                          Approve
                        </button>
                      </form>
                    )}

                    <form action={markWithdrawalPaid}>
                      <input type="hidden" name="withdrawalId" value={w.id} />
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl transition-all duration-150"
                      >
                        I&apos;ve sent it — mark paid
                      </button>
                    </form>

                    <form action={rejectWithdrawal} className="flex flex-col gap-2">
                      <input type="hidden" name="withdrawalId" value={w.id} />
                      <input
                        name="note"
                        type="text"
                        maxLength={300}
                        placeholder="Reason (sent to the user)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-400"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 px-4 text-xs font-bold rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                      >
                        Reject &amp; return the money
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── RECORD ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">Settled</h2>

        <Card className="overflow-hidden">
          {closed.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500 text-center">Nothing settled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80">
                    <th className={th}>User</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={th}>Paid into</th>
                    <th className={th}>Approved by</th>
                    <th className={th}>Processed by</th>
                    <th className={th}>Requested</th>
                    <th className={th}>Settled</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closed.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className={`${td} min-w-44`}>
                        <p className="text-sm font-bold text-slate-900">
                          {w.user?.full_name || "—"}
                        </p>
                        <p className="text-xs text-slate-500">{w.user?.email || "—"}</p>
                      </td>
                      <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                        {fmtNaira(w.amount)}
                      </td>
                      <td className={`${td} text-xs text-slate-600 min-w-40`}>
                        {w.account ? (
                          <>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              {w.account.account_number}
                            </span>
                            <span className="block text-slate-500">
                              {w.account.account_name} · {w.account.bank_name}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${td} text-xs text-slate-600 whitespace-nowrap`}>
                        {w.approver?.full_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${td} text-xs text-slate-600 whitespace-nowrap`}>
                        {w.processor?.full_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                        {fmtDateTime(w.requested_at)}
                      </td>
                      <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                        {fmtDateTime(w.processed_at ?? w.requested_at)}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            (STATUS[w.status] ?? STATUS.pending).cls
                          }`}
                        >
                          {(STATUS[w.status] ?? STATUS.pending).label}
                        </span>
                        {w.admin_note && (
                          <p className="text-[11px] text-red-600 mt-1 max-w-48">{w.admin_note}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <p className="text-xs text-slate-400">
        Showing the 200 most recent requests. Approving and paying are recorded separately, since
        they are often done by different people.
      </p>
    </div>
  );
}
