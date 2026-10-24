/**
 * WITHDRAW — the withdrawable balance, the request form, the payout schedule
 * and every withdrawal already asked for.
 *
 * Three real tables rather than three lists of rows: these are statements, and
 * figures that line up in a column can be scanned and added up. Each one drops
 * its less important columns on a phone instead of shrinking the amounts.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WithdrawForm } from "@/components/dashboard/forms";
import { ResponsiveMoney } from "@/components/BalanceToggle";
import { fmtNaira, fmtDate } from "@/lib/format";
import { getMoneySettings } from "@/lib/settings";

export const metadata = { title: "Withdraw · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = `px-5 py-2.5 ${eyebrow} text-slate-400 whitespace-nowrap`;
const td = "px-5 py-3.5 align-middle";

const WITHDRAWAL_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/80">
      <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
      {right}
    </div>
  );
}

export default async function PayoutsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [
    { data: balance },
    { data: payouts },
    { data: accounts },
    { data: withdrawals },
    { data: kyc },
    { data: hasPin },
  ] = await Promise.all([
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
    supabase.from("kyc_submissions").select("status").eq("user_id", user.id),
    supabase.rpc("has_transaction_pin"),
  ]);

  const upcoming = (payouts ?? []).filter((p) => p.status === "scheduled");
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reverse();
  const money = await getMoneySettings();
  const rows = withdrawals ?? [];

  // An approved row anywhere in the history is what counts; a rejected one
  // leaves the user back at "none" so the form points them at Verification.
  const kycStatus = (kyc ?? []).some((k) => k.status === "approved")
    ? "approved"
    : (kyc ?? []).some((k) => k.status === "pending")
      ? "pending"
      : "none";

  const poolName = (p: { pool: unknown }) =>
    (p.pool as { name?: string } | null)?.name ?? "—";

  const upcomingTotal = upcoming.reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal = paid.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Withdraw</h1>
        <p className="text-sm text-slate-500 mt-1">
          Move your balance to a bank account in your name.
        </p>
      </div>

      {/* ── BALANCE + REQUEST ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-[#0d2137] p-6 flex flex-col justify-center">
          <p className={`${eyebrow} text-slate-500 mb-1.5`}>Available to withdraw</p>
          <p className="text-3xl font-black text-white tabular-nums tracking-tight">
            {fmtNaira(Number(balance ?? 0))}
          </p>
        </div>
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">Request a withdrawal</h2>
          <WithdrawForm
            accounts={accounts ?? []}
            balance={Number(balance ?? 0)}
            kycStatus={kycStatus}
            hasPin={Boolean(hasPin)}
            fee={money.withdrawalFee}
            paused={!money.withdrawalsEnabled}
          />
        </Card>
      </div>

      {/* ── WITHDRAWALS ASKED FOR ── */}
      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <SectionHead
            title="Your withdrawals"
            right={<span className={`${eyebrow} text-slate-400`}>{rows.length} total</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80">
                  <th className={th}>Requested</th>
                  <th className={`${th} hidden sm:table-cell`}>Processed</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${td} text-xs text-slate-600 whitespace-nowrap`}>
                      {fmtDate(w.requested_at)}
                      {w.admin_note && (
                        <span className="block text-[11px] text-slate-400 whitespace-normal max-w-56">
                          {w.admin_note}
                        </span>
                      )}
                    </td>
                    <td className={`${td} hidden sm:table-cell text-xs text-slate-500 whitespace-nowrap`}>
                      {w.processed_at ? fmtDate(w.processed_at) : "—"}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                          WITHDRAWAL_BADGE[w.status] ?? ""
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                      <ResponsiveMoney value={Number(w.amount)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── WHAT IS STILL COMING ── */}
      <Card className="overflow-hidden">
        <SectionHead
          title="Upcoming payouts"
          right={
            upcoming.length > 0 ? (
              <span className={`${eyebrow} text-slate-400 tabular-nums`}>
                {fmtNaira(upcomingTotal)} to come
              </span>
            ) : undefined
          }
        />
        {upcoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Nothing scheduled yet. Join a pool to start earning.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80">
                  <th className={th}>Due</th>
                  <th className={th}>Pool</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${td} text-xs font-semibold text-slate-700 whitespace-nowrap`}>
                      {fmtDate(p.due_date)}
                    </td>
                    <td className={`${td} text-xs text-slate-500`}>{poolName(p)}</td>
                    <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                      <ResponsiveMoney value={Number(p.amount)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── WHAT HAS LANDED ── */}
      {paid.length > 0 && (
        <Card className="overflow-hidden">
          <SectionHead
            title="Paid payouts"
            right={
              <span className={`${eyebrow} text-green-600 tabular-nums`}>
                {fmtNaira(paidTotal)} received
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80">
                  <th className={th}>Paid</th>
                  <th className={th}>Pool</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paid.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${td} text-xs font-semibold text-slate-700 whitespace-nowrap`}>
                      {fmtDate(p.paid_at)}
                    </td>
                    <td className={`${td} text-xs text-slate-500`}>{poolName(p)}</td>
                    <td className={`${td} text-right text-sm font-extrabold text-green-600 tabular-nums whitespace-nowrap`}>
                      <ResponsiveMoney value={Number(p.amount)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
