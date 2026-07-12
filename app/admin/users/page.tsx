/**
 * ADMIN → USERS — every registered user with their totals, plus
 * "Reset access": emails the user a password-reset link so they can get back
 * into their dashboard (their data is untouched).
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendUserPasswordReset } from "@/app/actions/admin";
import { fmtNaira, fmtDate } from "@/lib/format";

export default async function AdminUsersPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: users }, { data: investments }, { data: payouts }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, state_of_residence, role, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("investments").select("user_id, amount, status"),
    admin.from("payouts").select("user_id, amount, status"),
  ]);

  // Per-user totals.
  const investedBy = new Map<string, number>();
  for (const i of investments ?? []) {
    if (i.status === "paid") investedBy.set(i.user_id, (investedBy.get(i.user_id) ?? 0) + Number(i.amount));
  }
  const earnedBy = new Map<string, number>();
  for (const p of payouts ?? []) {
    if (p.status === "paid") earnedBy.set(p.user_id, (earnedBy.get(p.user_id) ?? 0) + Number(p.amount));
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">
          {users?.length ?? 0} registered. "Reset access" emails the user a password-reset link.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="px-5 py-3 font-bold">User</th>
              <th className="px-5 py-3 font-bold">Phone / State</th>
              <th className="px-5 py-3 font-bold">Invested</th>
              <th className="px-5 py-3 font-bold">Earned</th>
              <th className="px-5 py-3 font-bold">Joined</th>
              <th className="px-5 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-900">
                    {u.full_name}
                    {u.role === "admin" && (
                      <span className="ml-2 text-[9px] font-bold text-[#0d2137] bg-amber-400 px-1.5 py-0.5 rounded uppercase">Admin</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {u.phone}<br />{u.state_of_residence}
                </td>
                <td className="px-5 py-3 font-extrabold text-slate-900 tabular-nums">{fmtNaira(investedBy.get(u.id) ?? 0)}</td>
                <td className="px-5 py-3 font-extrabold text-green-600 tabular-nums">{fmtNaira(earnedBy.get(u.id) ?? 0)}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                <td className="px-5 py-3">
                  <form action={sendUserPasswordReset}>
                    <input type="hidden" name="email" value={u.email} />
                    <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap">
                      Reset access
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
