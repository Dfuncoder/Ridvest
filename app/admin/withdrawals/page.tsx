/**
 * ADMIN → WITHDRAWALS — review requests before paying.
 * Shows a NAME MATCH indicator: the bank account holder vs. the profile name.
 * (The database already blocks mismatched requests; this is the final human
 * check before you send the transfer.)
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { approveWithdrawal, markWithdrawalPaid, rejectWithdrawal } from "@/app/actions/admin";
import { fmtNaira, fmtDate } from "@/lib/format";

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: withdrawals } = await admin
    .from("withdrawals")
    .select("id, amount, status, admin_note, requested_at, processed_at, user:profiles(full_name, email), account:withdrawal_accounts(bank_name, account_number, account_name)")
    .order("requested_at", { ascending: false })
    .limit(200);

  const open = (withdrawals ?? []).filter((w) => w.status === "pending" || w.status === "approved");
  const closed = (withdrawals ?? []).filter((w) => w.status === "paid" || w.status === "rejected");

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Withdrawals</h1>
        <p className="text-sm text-slate-500">
          Pay the bank transfer yourself, then mark it paid here. Rejecting returns the money to the user's balance.
        </p>
      </div>

      {/* Open requests */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-slate-900">Needs action ({open.length})</h2>
        {open.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">No open withdrawal requests.</p>
          </div>
        )}
        {open.map((w) => {
          const user = w.user as unknown as { full_name: string; email: string };
          const account = w.account as unknown as { bank_name: string; account_number: string; account_name: string };
          const match = namesMatch(account?.account_name ?? "", user?.full_name ?? "");
          return (
            <div key={w.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <p className="text-base font-extrabold text-slate-900 tabular-nums">{fmtNaira(w.amount)}</p>
                  <p className="text-xs text-slate-400">
                    {user?.full_name} · {user?.email} · requested {fmtDate(w.requested_at)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                  w.status === "pending"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                }`}>
                  {w.status}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-3">
                <p className="text-sm font-bold text-slate-900">{account?.bank_name}</p>
                <p className="text-xs text-slate-500 tabular-nums">{account?.account_number} · {account?.account_name}</p>
                {/* ★ Name-match indicator */}
                <p className={`text-xs font-bold mt-1.5 ${match ? "text-green-600" : "text-red-500"}`}>
                  {match
                    ? "✓ Account name matches profile name"
                    : `✗ NAME MISMATCH — profile says "${user?.full_name}". Do not pay.`}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {w.status === "pending" && (
                  <form action={approveWithdrawal}>
                    <input type="hidden" name="withdrawalId" value={w.id} />
                    <button type="submit" className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors">
                      Approve
                    </button>
                  </form>
                )}
                <form action={markWithdrawalPaid}>
                  <input type="hidden" name="withdrawalId" value={w.id} />
                  <button type="submit" className="text-xs font-bold px-4 py-2 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors">
                    Mark paid (transfer sent)
                  </button>
                </form>
                <form action={rejectWithdrawal} className="flex gap-2 flex-1 min-w-[220px]">
                  <input type="hidden" name="withdrawalId" value={w.id} />
                  <input
                    type="text"
                    name="note"
                    placeholder="Rejection reason (shown to user)"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-red-300"
                  />
                  <button type="submit" className="text-xs font-bold px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      {closed.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">History</h2>
          <div className="divide-y divide-slate-100">
            {closed.map((w) => {
              const user = w.user as unknown as { full_name: string };
              return (
                <div key={w.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold tabular-nums">{fmtNaira(w.amount)}</span> → {user?.full_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(w.processed_at)}{w.admin_note ? ` · ${w.admin_note}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                    w.status === "paid"
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}>
                    {w.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
