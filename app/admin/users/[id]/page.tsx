/**
 * ADMIN → USER DETAIL — everything recorded about one account.
 *
 * Gated by requireAdmin() like the rest of /admin, and every action on this
 * page re-checks it server-side; the layout guard alone is not treated as
 * enough for something that can lock or delete an account.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendUserPasswordReset } from "@/app/actions/admin";
import { LockControls, DeleteUserControls } from "@/components/admin/UserActions";
import { namesMatch } from "@/lib/names";
import { fmtNaira, fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "User · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = `px-4 py-3 ${eyebrow} text-slate-400 whitespace-nowrap`;
const td = "px-4 py-3.5 align-middle";

/** Both embeds name their constraint: transfers has two FKs into profiles. */
const TRANSFER_SELECT =
  "id, amount, note, reference, created_at, sender_id, recipient_id, " +
  "sender:profiles!transfers_sender_id_fkey(id, full_name, user_code), " +
  "recipient:profiles!transfers_recipient_id_fkey(id, full_name, user_code)";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <dt className={`${eyebrow} text-slate-400 shrink-0`}>{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 text-right break-words min-w-0">
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const [
    { data: accounts },
    { data: investments },
    { data: deposits },
    { data: payouts },
    { data: withdrawals },
    { data: balance },
    { data: locker },
    { data: transfersOut },
    { data: transfersIn },
  ] = await Promise.all([
    admin
      .from("withdrawal_accounts")
      .select("id, bank_name, account_number, account_name, name_verified, created_at")
      .eq("user_id", id),
    admin
      .from("investments")
      .select("id, amount, status, created_at, pool:pools(name)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("deposits")
      .select("id, credited_amount, method, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin.from("payouts").select("amount, status").eq("user_id", id),
    admin
      .from("withdrawals")
      .select("id, amount, status, requested_at")
      .eq("user_id", id)
      .order("requested_at", { ascending: false }),
    admin.rpc("available_balance", { p_user_id: id }),
    profile.locked_by
      ? admin.from("profiles").select("full_name").eq("id", profile.locked_by).maybeSingle()
      : Promise.resolve({ data: null }),
    // Each direction separately, then merged below.
    //
    // transfers has two foreign keys into profiles, so each embed has to name
    // its constraint. And .eq() rather than one .or(): .or() takes a filter
    // string, so the id would be interpolated into it, and a crafted route
    // param could append filters of its own.
    admin
      .from("transfers")
      .select(TRANSFER_SELECT)
      .eq("sender_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("transfers")
      .select(TRANSFER_SELECT)
      .eq("recipient_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const invested = (investments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const earned = (payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const deposited = (deposits ?? [])
    .filter((d) => d.status === "credited")
    .reduce((s, d) => s + Number(d.credited_amount ?? 0), 0);
  const withdrawn = (withdrawals ?? [])
    .filter((w) => w.status === "paid")
    .reduce((s, w) => s + Number(w.amount), 0);

  type TransferParty = { id: string; full_name: string | null; user_code: string | null } | null;
  type UserTransfer = {
    id: string;
    amount: number;
    note: string | null;
    reference: string;
    created_at: string;
    sender_id: string;
    recipient_id: string;
    sender: TransferParty;
    recipient: TransferParty;
  };

  const sentRows = (transfersOut ?? []) as unknown as UserTransfer[];
  const receivedRows = (transfersIn ?? []) as unknown as UserTransfer[];

  // Merged into one sequence, newest first: reading an account for abuse is
  // about the order things happened, not about the two directions separately.
  const transferRows = [...sentRows, ...receivedRows].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  const sentTotal = sentRows.reduce((s, t) => s + Number(t.amount), 0);
  const receivedTotal = receivedRows.reduce((s, t) => s + Number(t.amount), 0);

  const recordCount =
    (investments ?? []).length +
    (deposits ?? []).length +
    (payouts ?? []).length +
    (withdrawals ?? []).length +
    transferRows.length;

  const locked = Boolean(profile.locked_at);
  const isAdmin = profile.role === "admin";

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <Link
        href="/admin/users"
        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
      >
        ← All users
      </Link>

      {/* ── IDENTITY ── */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-400 to-amber-300 flex items-center justify-center text-[#0d2137] font-extrabold text-xl shrink-0">
              {(profile.full_name || profile.email || "R").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
                  {profile.full_name}
                </h1>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-[#0d2137]">
                    ADMIN
                  </span>
                )}
                {locked && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                    LOCKED
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 truncate">{profile.email}</p>
              <p className="font-mono text-xs text-slate-400 mt-0.5">{profile.user_code ?? "—"}</p>
            </div>
          </div>

          <div className="text-right">
            <p className={`${eyebrow} text-slate-400 mb-1`}>Available balance</p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
              {fmtNaira(Number(balance ?? 0))}
            </p>
          </div>
        </div>

        {locked && (
          <div className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-bold text-red-800">
              Locked {fmtDateTime(profile.locked_at)}
              {locker?.full_name && ` by ${locker.full_name}`}
            </p>
            {profile.lock_reason && (
              <p className="text-xs text-red-700 mt-0.5">{profile.lock_reason}</p>
            )}
          </div>
        )}
      </Card>

      {/* ── MONEY ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "Deposited", value: fmtNaira(deposited), tone: "text-slate-900" },
          { label: "Invested", value: fmtNaira(invested), tone: "text-blue-600" },
          { label: "Earned", value: fmtNaira(earned), tone: "text-green-600" },
          { label: "Withdrawn", value: fmtNaira(withdrawn), tone: "text-amber-600" },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        {/* ── RECORDED DETAILS ── */}
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">Recorded details</h2>
          <dl>
            <Detail label="Full name" value={profile.full_name} />
            <Detail label="Email" value={profile.email} />
            <Detail label="Phone" value={profile.phone} />
            <Detail label="Date of birth" value={fmtDate(profile.dob)} />
            <Detail label="Address" value={profile.address} />
            <Detail label="State" value={profile.state_of_residence} />
            <Detail label="Account ID" value={profile.user_code} />
            <Detail label="Role" value={profile.role} />
            <Detail label="Joined" value={fmtDateTime(profile.created_at)} />
            <Detail label="Last active" value={fmtDateTime(profile.last_active_at)} />
          </dl>
        </Card>

        {/* ── BANK ACCOUNTS ── */}
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Withdrawal accounts</h2>
          <p className="text-xs text-slate-500 mb-4">
            The holder name must match the profile name or a withdrawal is refused.
          </p>

          {(accounts ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">None added.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(accounts ?? []).map((a) => {
                const match = namesMatch(a.account_name, profile.full_name);
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border px-3.5 py-3 ${
                      match ? "bg-slate-50 border-slate-200" : "bg-red-50 border-red-200"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {a.account_number}
                    </p>
                    <p className="text-xs text-slate-600">
                      {a.account_name} · {a.bank_name}
                    </p>
                    <p
                      className={`text-[11px] font-bold mt-1 ${
                        match ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {match ? "Name matches" : "Name does not match the profile"}
                      {a.name_verified && <span className="text-slate-400"> · bank-verified</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── ACTIVITY ── */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-slate-900 mb-4">Activity</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              title: "Investments",
              rows: (investments ?? []).slice(0, 6).map((i) => ({
                key: i.id,
                main: fmtNaira(i.amount),
                sub: `${(i.pool as unknown as { name?: string } | null)?.name ?? "—"} · ${i.status.replace(/_/g, " ")}`,
                at: i.created_at,
              })),
              total: (investments ?? []).length,
            },
            {
              title: "Deposits",
              rows: (deposits ?? []).slice(0, 6).map((d) => ({
                key: d.id,
                main: d.credited_amount === null ? "—" : fmtNaira(d.credited_amount),
                sub: `${d.method === "manual" ? "Transfer" : "Card"} · ${d.status.replace(/_/g, " ")}`,
                at: d.created_at,
              })),
              total: (deposits ?? []).length,
            },
            {
              title: "Withdrawals",
              rows: (withdrawals ?? []).slice(0, 6).map((w) => ({
                key: w.id,
                main: fmtNaira(w.amount),
                sub: w.status,
                at: w.requested_at,
              })),
              total: (withdrawals ?? []).length,
            },
          ].map((group) => (
            <div key={group.title}>
              <p className={`${eyebrow} text-slate-400 mb-2`}>
                {group.title} ({group.total})
              </p>
              {group.rows.length === 0 ? (
                <p className="text-xs text-slate-400">None.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.rows.map((r) => (
                    <li key={r.key} className="bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{r.main}</p>
                      <p className="text-[11px] text-slate-500 capitalize">{r.sub}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(r.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── TRANSFERS ──
          Both directions in one table, because what matters when reading an
          account for abuse is the sequence: money in, then straight back out,
          is the shape worth seeing. The counterparty links through, so a chain
          can be walked account to account. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
          <h2 className="text-sm font-extrabold text-slate-900">
            Transfers <span className="font-bold text-slate-400">({transferRows.length})</span>
          </h2>
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500">
              Sent{" "}
              <span className="font-bold tabular-nums text-slate-900">{fmtNaira(sentTotal)}</span>
            </span>
            <span className="text-slate-500">
              Received{" "}
              <span className="font-bold tabular-nums text-green-600">
                {fmtNaira(receivedTotal)}
              </span>
            </span>
          </div>
        </div>

        {transferRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            This account has never sent or received a transfer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className={th}>When</th>
                  <th className={th}>Direction</th>
                  <th className={th}>Counterparty</th>
                  <th className={`${th} hidden lg:table-cell`}>Note</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferRows.map((t) => {
                  const outgoing = t.sender_id === id;
                  const other = outgoing ? t.recipient : t.sender;
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                      <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>
                        {fmtDateTime(t.created_at)}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <span
                          className={`${eyebrow} rounded-full border px-2.5 py-1 ${
                            outgoing
                              ? "border-slate-500/20 bg-slate-500/10 text-slate-600"
                              : "border-green-500/20 bg-green-500/10 text-green-600"
                          }`}
                        >
                          {outgoing ? "Sent" : "Received"}
                        </span>
                      </td>
                      <td className={`${td} min-w-40`}>
                        {other ? (
                          <Link href={`/admin/users/${other.id}`} className="group block min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-amber-600">
                              {other.full_name ?? "—"}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {other.user_code ?? ""}
                            </p>
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`${td} hidden max-w-56 lg:table-cell text-xs text-slate-500`}>
                        {t.note || "—"}
                      </td>
                      <td
                        className={`${td} whitespace-nowrap text-right text-sm font-extrabold tabular-nums ${
                          outgoing ? "text-slate-900" : "text-green-600"
                        }`}
                      >
                        {outgoing ? "−" : "+"}
                        {fmtNaira(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── ADMIN ACTIONS ── */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Account actions</h2>
        <p className="text-xs text-slate-500 mb-4">
          Every action here is recorded in the audit log against your name.
        </p>

        {isAdmin ? (
          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
            This is an admin account. Locking or deleting admins is not possible from here — it is
            how you end up with nobody able to undo it. Change the role in the database if you
            really need to.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 items-start">
            <div>
              <p className={`${eyebrow} text-slate-400 mb-2`}>Password</p>
              <form action={sendUserPasswordReset}>
                <input type="hidden" name="userId" value={profile.id} />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition-colors"
                >
                  Email a reset link
                </button>
              </form>
            </div>

            <div>
              <p className={`${eyebrow} text-slate-400 mb-2`}>Access</p>
              <LockControls userId={profile.id} locked={locked} />
            </div>

            <div>
              <p className={`${eyebrow} text-slate-400 mb-2`}>Danger zone</p>
              <DeleteUserControls
                userId={profile.id}
                email={profile.email ?? ""}
                hasRecords={recordCount > 0}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
