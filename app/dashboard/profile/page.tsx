/**
 * PROFILE — read-only personal details, the account ID, and withdrawal banks.
 *
 * Nothing here is editable. The withdrawal name-match rule compares the bank
 * account name to full_name, so a user who could edit their own name could
 * point it at somebody else's account. Corrections go through an admin.
 */
import { requireUser, getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddAccountForm } from "@/components/dashboard/forms";
import { CodeCard } from "@/components/dashboard/ProfileDetails";
import { deleteWithdrawalAccount, listBanks } from "@/app/actions/account";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Profile · Rydvest" };

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] shrink-0">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-900 text-right break-words min-w-0">
        {value || "—"}
      </dd>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: accounts }, banks] = await Promise.all([
    supabase
      .from("withdrawal_accounts")
      .select("id, bank_name, account_number, account_name, name_verified, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    listBanks(),
  ]);

  const initial = (profile.full_name || profile.email || "R").charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      {/* ── Identity ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm shadow-slate-200/40">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-amber-400 to-amber-300 flex items-center justify-center text-[#0d2137] font-extrabold text-2xl shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
              {profile.full_name}
            </h1>
            <p className="text-sm text-slate-500 truncate">{profile.email}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Member since {fmtDate(profile.created_at)}
            </p>
          </div>
        </div>
      </div>

      <CodeCard code={profile.user_code ?? ""} />

      {/* ── Personal details ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm shadow-slate-200/40">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-extrabold text-slate-900">Personal details</h2>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Locked
          </span>
        </div>

        <dl>
          <Detail label="Full name" value={profile.full_name} />
          <Detail label="Email" value={profile.email} />
          <Detail label="Phone" value={profile.phone} />
          <Detail label="Date of birth" value={fmtDate(profile.dob)} />
          <Detail label="Address" value={profile.address} />
          <Detail label="State" value={profile.state_of_residence} />
        </dl>

        <p className="text-xs text-slate-500 leading-relaxed mt-4 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
          These details are locked because your withdrawals are paid to a bank account in this exact
          name.{" "}
          <a href="/contact" className="font-semibold text-amber-600 hover:text-amber-500">
            Contact support
          </a>{" "}
          if anything here is wrong.
        </p>
      </div>

      {/* ── Withdrawal banks ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm shadow-slate-200/40">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Withdrawal accounts</h2>
        <p className="text-xs text-slate-500 mb-5">
          Where your money goes when you withdraw. The account must be in your own name.
        </p>

        {(accounts ?? []).length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {(accounts ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 truncate">{a.account_name}</p>
                    {a.name_verified && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 shrink-0">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                    {a.account_number} · {a.bank_name}
                  </p>
                </div>
                <form action={deleteWithdrawalAccount}>
                  <input type="hidden" name="accountId" value={a.id} />
                  <button
                    type="submit"
                    className="text-xs text-slate-400 hover:text-red-600 font-semibold px-2 py-1 transition-colors"
                    aria-label={`Remove ${a.bank_name} account`}
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <AddAccountForm profileName={profile.full_name} banks={banks} />
      </div>
    </div>
  );
}
