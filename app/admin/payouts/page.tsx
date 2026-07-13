/**
 * ADMIN → PAYOUTS — the weekly schedule generated when pools fill.
 * "Mark paid" credits the investor's withdrawable balance (and the ledger);
 * due payouts are listed first.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markPayoutPaid } from "@/app/actions/admin";
import { fmtNaira, fmtDate } from "@/lib/format";

export default async function AdminPayoutsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: due }, { data: upcoming }, { data: recentPaid }] = await Promise.all([
    admin
      .from("payouts")
      .select("id, amount, due_date, user:profiles(full_name, email), pool:pools(name)")
      .eq("status", "scheduled")
      .lte("due_date", today)
      .order("due_date", { ascending: true }),
    admin
      .from("payouts")
      .select("id, amount, due_date, user:profiles(full_name), pool:pools(name)")
      .eq("status", "scheduled")
      .gt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(30),
    admin
      .from("payouts")
      .select("id, amount, paid_at, user:profiles(full_name), pool:pools(name)")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(20),
  ]);

  const dueTotal = (due ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Payouts</h1>
        <p className="text-sm text-slate-500">
          Marking a payout paid credits the investor's withdrawable balance.
        </p>
      </div>

      {/* Due now */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-sm font-extrabold text-slate-900">Due now</h2>
          <p className="text-xs text-slate-500">
            {(due ?? []).length} payouts · <span className="font-extrabold text-amber-500">{fmtNaira(dueTotal)}</span>
          </p>
        </div>
        {(due ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 px-5 pb-5">Nothing due — all caught up. 🎉</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(due ?? []).map((p) => {
              const user = p.user as unknown as { full_name: string; email: string };
              const pool = p.pool as unknown as { name: string };
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtNaira(p.amount)} → {user?.full_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {pool?.name} · due {fmtDate(p.due_date)} · {user?.email}
                    </p>
                  </div>
                  <form action={markPayoutPaid}>
                    <input type="hidden" name="payoutId" value={p.id} />
                    <button type="submit" className="text-xs font-bold px-4 py-2 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors whitespace-nowrap">
                      Mark paid
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">Upcoming (next 30)</h2>
        {(upcoming ?? []).length === 0 ? (
          <p className="text-sm text-slate-500 px-5 pb-5">No scheduled payouts yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(upcoming ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold tabular-nums">{fmtNaira(p.amount)}</span>
                  {" → "}{(p.user as unknown as { full_name: string })?.full_name}
                  <span className="text-slate-400"> · {(p.pool as unknown as { name: string })?.name}</span>
                </p>
                <span className="text-xs text-slate-500">{fmtDate(p.due_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently paid */}
      {(recentPaid ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h2 className="text-sm font-extrabold text-slate-900 px-5 pt-4 pb-2">Recently paid</h2>
          <div className="divide-y divide-slate-100">
            {(recentPaid ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold tabular-nums">{fmtNaira(p.amount)}</span>
                  {" → "}{(p.user as unknown as { full_name: string })?.full_name}
                  <span className="text-slate-400"> · {(p.pool as unknown as { name: string })?.name}</span>
                </p>
                <span className="text-xs text-green-600 font-semibold">{fmtDate(p.paid_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
