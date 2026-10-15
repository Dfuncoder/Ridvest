/**
 * ADMIN → USERS — everyone registered, with the money each one represents.
 *
 * Search and the per-user drill-down are the point: locking and deleting live
 * on the detail page, where the whole record is in front of you, rather than
 * as a button next to a row you might click by mistake.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fmtNaira, fmtDate } from "@/lib/format";

export const metadata = { title: "Users · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let select = admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, state_of_residence, user_code, role, locked_at, created_at, last_active_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (query) {
    // Match a name, an email or an account ID. The % wrapping is ours, so a
    // user typing % cannot broaden the search beyond their own row set.
    const safe = query.replace(/[%_]/g, "");
    select = select.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,user_code.ilike.%${safe}%`
    );
  }

  const [{ data: users, error }, { data: investments }, { data: payouts }, { data: deposits }] =
    await Promise.all([
      select,
      admin.from("investments").select("user_id, amount, status"),
      admin.from("payouts").select("user_id, amount, status"),
      admin.from("deposits").select("user_id, credited_amount, status"),
    ]);

  if (error) console.error("[admin] users query failed", error);

  const sumBy = <T extends { user_id: string }>(
    rows: T[] | null,
    amount: (r: T) => number,
    keep: (r: T) => boolean
  ) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!keep(r)) continue;
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + amount(r));
    }
    return map;
  };

  const investedBy = sumBy(investments, (i) => Number(i.amount), (i) => i.status === "paid");
  const earnedBy = sumBy(payouts, (p) => Number(p.amount), (p) => p.status === "paid");
  const depositedBy = sumBy(
    deposits,
    (d) => Number(d.credited_amount ?? 0),
    (d) => d.status === "credited"
  );

  const rows = users ?? [];
  const lockedCount = rows.filter((u) => u.locked_at).length;
  const adminCount = rows.filter((u) => u.role === "admin").length;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Open a user to see everything recorded about them, and to lock or remove the account.
        </p>
      </div>

      {/* ── COUNTS ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Registered", value: String(rows.length), tone: "text-slate-900" },
          { label: "Locked", value: String(lockedCount), tone: lockedCount ? "text-red-500" : "text-slate-300" },
          { label: "Admins", value: String(adminCount), tone: "text-amber-600" },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── SEARCH ── */}
      <form className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search name, email or account ID"
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors shadow-sm shadow-slate-200/40"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm rounded-xl transition-colors"
        >
          Search
        </button>
        {query && (
          <Link
            href="/admin/users"
            className="px-5 py-2.5 flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── LIST ── */}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-500 text-center">
            {query ? `Nobody matches "${query}".` : "No users yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className={th}>User</th>
                  <th className={th}>Contact</th>
                  <th className={`${th} text-right`}>Deposited</th>
                  <th className={`${th} text-right`}>Invested</th>
                  <th className={`${th} text-right`}>Earned</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className={u.locked_at ? "bg-red-50/40" : "hover:bg-slate-50/60 transition-colors"}
                  >
                    <td className={`${td} min-w-52`}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-amber-600 transition-colors"
                      >
                        {u.full_name || "—"}
                      </Link>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <p className="font-mono text-[10px] text-slate-400">{u.user_code ?? "—"}</p>
                    </td>

                    <td className={`${td} text-xs text-slate-600 min-w-36`}>
                      {u.phone || "—"}
                      <span className="block text-slate-400">{u.state_of_residence || "—"}</span>
                    </td>

                    <td className={`${td} text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(depositedBy.get(u.id) ?? 0)}
                    </td>
                    <td className={`${td} text-right text-sm font-bold text-blue-600 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(investedBy.get(u.id) ?? 0)}
                    </td>
                    <td className={`${td} text-right text-sm font-bold text-green-600 tabular-nums whitespace-nowrap`}>
                      {fmtNaira(earnedBy.get(u.id) ?? 0)}
                    </td>

                    <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                      {fmtDate(u.created_at)}
                      <span className="block text-slate-400">
                        {u.last_active_at ? `seen ${fmtDate(u.last_active_at)}` : "never seen"}
                      </span>
                    </td>

                    <td className={`${td} whitespace-nowrap`}>
                      {u.role === "admin" ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-[#0d2137]">
                          Admin
                        </span>
                      ) : u.locked_at ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                          Locked
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                          Active
                        </span>
                      )}
                    </td>

                    <td className={`${td} whitespace-nowrap`}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        Showing up to 500 users, newest first. Locking and deletion are on each user&apos;s page.
      </p>
    </div>
  );
}
