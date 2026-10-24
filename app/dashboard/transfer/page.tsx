/**
 * SEND — move balance to another Rydvest account by account ID.
 *
 * The form is gated on verification the same way withdrawing is: sending
 * balance to another account is how money leaves an account that is not yours,
 * so it sits behind the same identity check. transfer_to_user() refuses in SQL
 * regardless; this just says so before the form is filled in.
 */
import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TransferForm from "@/components/dashboard/TransferForm";
import { CodeCard } from "@/components/dashboard/ProfileDetails";
import { ResponsiveMoney } from "@/components/BalanceToggle";
import { fmtNaira, fmtDateTime } from "@/lib/format";
import { getMoneySettings } from "@/lib/settings";

export const metadata = { title: "Send · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = `px-5 py-2.5 ${eyebrow} text-slate-400 whitespace-nowrap`;
const td = "px-5 py-3.5 align-middle";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

type Party = { full_name: string | null; user_code: string | null } | null;

export default async function TransferPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createSupabaseServerClient();

  const [{ data: balance }, { data: kyc }, { data: hasPin }, { data: sent }, { data: received }] =
    await Promise.all([
    supabase.rpc("my_available_balance"),
    supabase.from("kyc_submissions").select("status").eq("user_id", user.id),
    supabase.rpc("has_transaction_pin"),
    supabase
      .from("transfers")
      .select("id, amount, note, created_at, recipient:profiles!transfers_recipient_id_fkey(full_name, user_code)")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("transfers")
      .select("id, amount, note, created_at, sender:profiles!transfers_sender_id_fkey(full_name, user_code)")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const money = await getMoneySettings();
  const walletBalance = Number(balance ?? 0);
  const kycStatus = (kyc ?? []).some((k) => k.status === "approved")
    ? "approved"
    : (kyc ?? []).some((k) => k.status === "pending")
      ? "pending"
      : "none";

  const sentRows = sent ?? [];
  const receivedRows = received ?? [];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Send</h1>
        <p className="text-sm text-slate-500 mt-1">
          Move money from your balance to another Rydvest account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── BALANCE + YOUR OWN ID ── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-[#0d2137] p-6">
            <p className={`${eyebrow} text-slate-500 mb-1.5`}>Your balance</p>
            <p className="text-3xl font-black text-white tabular-nums tracking-tight">
              {fmtNaira(walletBalance)}
            </p>
          </div>

          <CodeCard code={profile?.user_code ?? ""} />

          <Card className="px-5 py-4">
            <p className={`${eyebrow} text-slate-400 mb-2`}>Limits</p>
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Per transfer</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {fmtNaira(money.transferMinAmount)} – {fmtNaira(money.transferMaxAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Per day</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {fmtNaira(money.transferMaxPerDay)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* ── THE FORM ── */}
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4">Send money</h2>

          {!money.transfersEnabled ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
              Sending to other accounts is paused at the moment. Your balance is untouched and
              everything else works as normal — try again a little later.
            </p>
          ) : kycStatus === "approved" ? (
            <TransferForm
              balance={walletBalance}
              hasPin={Boolean(hasPin)}
              fee={money.transferFee}
              limits={{
                minAmount: money.transferMinAmount,
                maxAmount: money.transferMaxAmount,
                maxPerDay: money.transferMaxPerDay,
              }}
            />
          ) : kycStatus === "pending" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
              Your identity details are with us. We&apos;ll email you once they&apos;re confirmed,
              and sending opens straight after.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
                Verify your identity before you can send money — your NIN and a photo. It takes a few minutes.
              </p>
              <Link
                href="/dashboard/verify"
                className="rounded-xl bg-[#0d2137] px-4 py-2.5 text-center text-sm font-extrabold text-white transition-colors hover:bg-[#14314f]"
              >
                Verify my identity
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* ── SENT ── */}
      {sentRows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
            <h2 className="text-sm font-extrabold text-slate-900">Sent</h2>
            <span className={`${eyebrow} text-slate-400`}>{sentRows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60">
                  <th className={th}>To</th>
                  <th className={`${th} hidden sm:table-cell`}>Note</th>
                  <th className={th}>When</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sentRows.map((t) => {
                  const to = t.recipient as unknown as Party;
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                      <td className={`${td} min-w-40`}>
                        <p className="text-sm font-bold text-slate-900">{to?.full_name ?? "—"}</p>
                        <p className="font-mono text-[10px] text-slate-400">{to?.user_code ?? ""}</p>
                      </td>
                      <td className={`${td} hidden sm:table-cell max-w-56 text-xs text-slate-500`}>
                        {t.note || "—"}
                      </td>
                      <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>
                        {fmtDateTime(t.created_at)}
                      </td>
                      <td
                        className={`${td} whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-slate-900`}
                      >
                        −<ResponsiveMoney value={Number(t.amount)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── RECEIVED ── */}
      {receivedRows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
            <h2 className="text-sm font-extrabold text-slate-900">Received</h2>
            <span className={`${eyebrow} text-slate-400`}>{receivedRows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60">
                  <th className={th}>From</th>
                  <th className={`${th} hidden sm:table-cell`}>Note</th>
                  <th className={th}>When</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receivedRows.map((t) => {
                  const from = t.sender as unknown as Party;
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                      <td className={`${td} min-w-40`}>
                        <p className="text-sm font-bold text-slate-900">{from?.full_name ?? "—"}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {from?.user_code ?? ""}
                        </p>
                      </td>
                      <td className={`${td} hidden sm:table-cell max-w-56 text-xs text-slate-500`}>
                        {t.note || "—"}
                      </td>
                      <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>
                        {fmtDateTime(t.created_at)}
                      </td>
                      <td
                        className={`${td} whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-green-600`}
                      >
                        +<ResponsiveMoney value={Number(t.amount)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
