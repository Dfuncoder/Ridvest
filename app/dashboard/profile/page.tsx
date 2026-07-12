/**
 * PROFILE — view/edit personal details and manage withdrawal bank accounts.
 * The name-match rule is surfaced prominently: the bank account holder name
 * must equal the profile name or withdrawals will not go through.
 */
import { requireUser, getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm, AddAccountForm } from "@/components/dashboard/forms";
import { deleteWithdrawalAccount } from "@/app/actions/account";
import { fmtDate } from "@/lib/format";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();

  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("withdrawal_accounts")
    .select("id, bank_name, account_number, account_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Your personal details and withdrawal accounts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        {/* ── Personal details ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-1">Personal details</h2>
          <p className="text-xs text-slate-400 mb-4">
            Member since {fmtDate(profile.created_at)} · {profile.email}
          </p>
          <ProfileForm
            profile={{
              full_name: profile.full_name,
              phone: profile.phone,
              address: profile.address,
              state_of_residence: profile.state_of_residence,
            }}
          />
          <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-500 space-y-1">
            <p><span className="font-semibold text-slate-700">Date of birth:</span> {fmtDate(profile.dob)}</p>
            <p className="text-slate-400">Email and date of birth can't be changed — contact support if they're wrong.</p>
          </div>
        </div>

        {/* ── Withdrawal details ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-sm font-extrabold text-slate-900 mb-1">Withdrawal details</h2>
            <p className="text-xs text-slate-400 mb-4">
              The bank account name must match your profile name — mismatched accounts can't receive withdrawals.
            </p>

            {(accounts ?? []).length > 0 && (
              <div className="flex flex-col gap-2 mb-5">
                {(accounts ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{a.bank_name}</p>
                      <p className="text-xs text-slate-500 tabular-nums">{a.account_number} · {a.account_name}</p>
                    </div>
                    {/* Delete via server action — RLS restricts to own rows. */}
                    <form action={deleteWithdrawalAccount}>
                      <input type="hidden" name="accountId" value={a.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1" aria-label={`Remove ${a.bank_name} account`}>
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <AddAccountForm profileName={profile.full_name} />
          </div>
        </div>
      </div>
    </div>
  );
}
