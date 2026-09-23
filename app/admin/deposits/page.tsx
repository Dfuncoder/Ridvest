/**
 * ADMIN → DEPOSITS — bank transfers users say they've sent, waiting to be
 * checked against the company account, plus a record of everything settled.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DepositActions } from "@/components/admin/DepositActions";
import { fmtNaira, fmtDate } from "@/lib/format";

export const metadata = { title: "Deposits · Rydvest admin" };

type DepositRow = {
  id: string;
  amount: number | null;
  credited_amount: number | null;
  method: string;
  status: string;
  reference: string;
  admin_note: string | null;
  created_at: string;
  credited_at: string | null;
  user_id: string;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
};

type BankAccount = {
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
};

/** Credited rows carry a real figure; a rejected declaration never had one. */
function settledAmount(d: DepositRow): number | null {
  const value = d.credited_amount ?? d.amount;
  return value === null || value === undefined ? null : Number(value);
}

export default async function AdminDepositsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("deposits")
    .select(
      "id, amount, credited_amount, method, status, reference, admin_note, created_at, credited_at, user_id, profile:profiles(full_name, email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Deposits</h1>
        <p className="text-sm text-slate-500">
          Check the company account for the money before crediting anyone.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">
          Waiting on you
          {awaiting.length > 0 && (
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {awaiting.length}
            </span>
          )}
        </h2>

        {awaiting.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Sender must match
                    </p>
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

                  <p className="text-[11px] text-slate-400 mt-2.5 font-mono break-all">{d.reference}</p>
                  <p className="text-[11px] text-slate-400">Declared {fmtDate(d.created_at)}</p>
                </div>
                <DepositActions depositId={d.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">Settled</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {settled.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">Nothing settled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-bold">User</th>
                    <th className="px-5 py-3 font-bold">Amount</th>
                    <th className="px-5 py-3 font-bold">Method</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settled.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{d.profile?.full_name || "—"}</p>
                        <p className="text-xs text-slate-500">{d.profile?.email || "—"}</p>
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">
                        {settledAmount(d) === null ? "—" : fmtNaira(settledAmount(d) as number)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 capitalize">{d.method}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            d.status === "credited"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : d.status === "rejected"
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                          }`}
                        >
                          {d.status === "credited"
                            ? "Credited"
                            : d.status === "rejected"
                              ? "Rejected"
                              : "Awaiting payment"}
                        </span>
                        {d.admin_note && (
                          <p className="text-[11px] text-slate-400 mt-1">{d.admin_note}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {fmtDate(d.credited_at ?? d.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
