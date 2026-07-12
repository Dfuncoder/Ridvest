/**
 * ADMIN → INVESTMENTS — every payment with its Paystack reference so the
 * books can be reconciled against the Paystack dashboard line by line.
 * Refund-pending rows (paid after a pool filled) are actioned here.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markInvestmentRefunded } from "@/app/actions/admin";
import { fmtNaira, fmtDate } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  pending_payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  refund_pending: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  amount_mismatch: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default async function AdminInvestmentsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: investments } = await admin
    .from("investments")
    .select("id, amount, status, paystack_reference, paid_at, created_at, user:profiles(full_name, email), pool:pools(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const totalPaid = (investments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">Investments</h1>
          <p className="text-sm text-slate-500">
            Match the Paystack reference against your Paystack dashboard to reconcile.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Confirmed total: <span className="font-extrabold text-slate-900">{fmtNaira(totalPaid)}</span>
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="px-5 py-3 font-bold">Investor</th>
              <th className="px-5 py-3 font-bold">Pool</th>
              <th className="px-5 py-3 font-bold">Amount</th>
              <th className="px-5 py-3 font-bold">Paystack ref</th>
              <th className="px-5 py-3 font-bold">Date</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(investments ?? []).map((inv) => {
              const user = inv.user as unknown as { full_name: string; email: string };
              const pool = inv.pool as unknown as { name: string };
              return (
                <tr key={inv.id}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{user?.full_name}</p>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{pool?.name}</td>
                  <td className="px-5 py-3 font-extrabold text-slate-900 tabular-nums">{fmtNaira(inv.amount)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{inv.paystack_reference}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(inv.paid_at ?? inv.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize whitespace-nowrap ${STATUS_STYLE[inv.status] ?? ""}`}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {inv.status === "refund_pending" && (
                      // Refund the charge in the Paystack dashboard first,
                      // then record it here.
                      <form action={markInvestmentRefunded}>
                        <input type="hidden" name="investmentId" value={inv.id} />
                        <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors whitespace-nowrap">
                          Mark refunded
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(investments ?? []).length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">No investments yet.</p>
        )}
      </div>
    </div>
  );
}
