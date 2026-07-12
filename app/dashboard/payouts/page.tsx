/**
 * PAYOUTS — the user's payout schedule, withdrawable balance, withdrawal
 * request form, and withdrawal history.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WithdrawForm } from "@/components/dashboard/forms";
import { fmtNaira, fmtDate } from "@/lib/format";

const WITHDRAWAL_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function PayoutsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: balance }, { data: payouts }, { data: accounts }, { data: withdrawals }] =
    await Promise.all([
      supabase.rpc("my_available_balance"),
      supabase
        .from("payouts")
        .select("id, amount, due_date, status, paid_at, pool:pools(name)")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
      supabase
        .from("withdrawal_accounts")
        .select("id, bank_name, account_number, account_name")
        .eq("user_id", user.id),
      supabase
        .from("withdrawals")
        .select("id, amount, status, admin_note, requested_at, processed_at")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false }),
    ]);

  const upcoming = (payouts ?? []).filter((p) => p.status === "scheduled");
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reverse();

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Payouts & withdrawals</h1>
        <p className="text-sm text-slate-500">
          Paid payouts build your balance; withdraw it to your verified bank account.
        </p>
      </div>

      {/* Balance + withdraw */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-[#0d2137] rounded-2xl p-6">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Available to withdraw</p>
          <p className="text-3xl font-black text-white tabular-nums">{fmtNaira(Number(balance ?? 0))}</p>
          <p className="text-xs text-slate-400 mt-3">
            Withdrawals are paid to a bank account that matches the name on your profile.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">Request a withdrawal</h2>
          <WithdrawForm accounts={accounts ?? []} balance={Number(balance ?? 0)} />
        </div>
      </div>

      {/* Withdrawal history */}
      {(withdrawals ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">Withdrawal history</h2>
          <div className="divide-y divide-slate-100">
            {(withdrawals ?? []).map((w) => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{fmtNaira(w.amount)}</p>
                  <p className="text-xs text-slate-400">
                    Requested {fmtDate(w.requested_at)}
                    {w.admin_note ? ` · ${w.admin_note}` : ""}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${WITHDRAWAL_BADGE[w.status] ?? ""}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming payouts */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">Upcoming payouts</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 px-5 pb-5">
            Nothing scheduled yet — payouts are generated when a pool you're in fills up.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{fmtNaira(p.amount)}</p>
                  <p className="text-xs text-slate-400">{(p.pool as unknown as { name: string })?.name}</p>
                </div>
                <span className="text-xs text-slate-500">Due {fmtDate(p.due_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paid payouts */}
      {paid.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">Paid payouts</h2>
          <div className="divide-y divide-slate-100">
            {paid.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{fmtNaira(p.amount)}</p>
                  <p className="text-xs text-slate-400">{(p.pool as unknown as { name: string })?.name}</p>
                </div>
                <span className="text-xs text-green-600 font-semibold">Paid {fmtDate(p.paid_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
