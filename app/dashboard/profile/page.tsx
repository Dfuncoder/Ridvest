/**
 * PROFILE — the account record: who you are, your account ID, whether you are
 * verified, and the banks you withdraw to.
 *
 * Laid out as a record rather than a list of sentences: a fixed label column
 * against a value column, so the whole thing reads down the page like a
 * statement. Stacks on phones, where two columns cannot hold an address.
 *
 * Nothing here is editable. The withdrawal name-match rule compares the bank
 * account name to full_name, so a user who could edit their own name could
 * point it at somebody else's account. Corrections go through an admin.
 */
import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddAccountForm } from "@/components/dashboard/forms";
import { CodeCard } from "@/components/dashboard/ProfileDetails";
import { deleteWithdrawalAccount, listBanks } from "@/app/actions/account";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Profile · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

/** One line of the record. Zebra striping does the tabulating, not rules. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4 sm:py-3.5 odd:bg-slate-50/60">
      <dt className={`${eyebrow} text-slate-400 self-center`}>{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 wrap-break-word min-w-0 self-center">
        {value || "—"}
      </dd>
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

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: accounts }, { data: kyc }, banks] = await Promise.all([
    supabase
      .from("withdrawal_accounts")
      .select("id, bank_name, account_number, account_name, name_verified, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("kyc_submissions").select("status").eq("user_id", user.id),
    listBanks(),
  ]);

  const kycStatus = (kyc ?? []).some((k) => k.status === "approved")
    ? "approved"
    : (kyc ?? []).some((k) => k.status === "pending")
      ? "pending"
      : "none";

  const initial = (profile.full_name || profile.email || "R").charAt(0).toUpperCase();
  const rows = accounts ?? [];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      {/* ── WHO ── */}
      <div className="rounded-2xl bg-[#0d2137] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-amber-400 to-amber-300 text-2xl font-extrabold text-[#0d2137]">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-white">
              {profile.full_name}
            </h1>
            <p className="truncate text-sm text-slate-400">{profile.email}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Member since {fmtDate(profile.created_at)}
            </p>
          </div>
        </div>

        {/* Verification sits here because it is the one thing on this page the
            user can still act on. */}
        <Link
          href="/dashboard/verify"
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 transition-colors hover:bg-white/10"
        >
          <div className="min-w-0">
            <p className={`${eyebrow} text-white/35`}>Identity</p>
            <p className="text-sm font-bold text-white">
              {kycStatus === "approved"
                ? "Verified"
                : kycStatus === "pending"
                  ? "Being checked"
                  : "Not verified yet"}
            </p>
          </div>
          <span
            className={`${eyebrow} shrink-0 rounded-full px-2.5 py-1 ${
              kycStatus === "approved"
                ? "bg-green-400/15 text-green-300"
                : kycStatus === "pending"
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-amber-400 text-[#0d2137]"
            }`}
          >
            {kycStatus === "approved" ? "Done" : kycStatus === "pending" ? "Waiting" : "Verify →"}
          </span>
        </Link>
      </div>

      <CodeCard code={profile.user_code ?? ""} />

      {/* ── THE RECORD ── */}
      <Card className="overflow-hidden">
        <SectionHead
          title="Personal details"
          right={
            <span className={`flex items-center gap-1.5 ${eyebrow} text-slate-400`}>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              Locked
            </span>
          }
        />

        <dl>
          <Row label="Full name" value={profile.full_name} />
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone} />
          <Row label="Date of birth" value={fmtDate(profile.dob)} />
          <Row label="Address" value={profile.address} />
          <Row label="State" value={profile.state_of_residence} />
        </dl>

        <p className="border-t border-slate-200/80 px-5 py-3.5 text-xs text-slate-500">
          Need any of this changed?{" "}
          <a href="/contact" className="font-semibold text-amber-600 hover:text-amber-500">
            Contact support
          </a>
          .
        </p>
      </Card>

      {/* ── BANKS ── */}
      <Card className="overflow-hidden">
        <SectionHead
          title="Withdrawal accounts"
          right={
            rows.length > 0 ? (
              <span className={`${eyebrow} text-slate-400`}>
                {rows.length} saved
              </span>
            ) : undefined
          }
        />

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60">
                  <th className={`px-5 py-2.5 ${eyebrow} text-slate-400`}>Account name</th>
                  <th className={`px-5 py-2.5 ${eyebrow} text-slate-400 whitespace-nowrap`}>
                    Number
                  </th>
                  <th className={`px-5 py-2.5 ${eyebrow} text-slate-400`}>Bank</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 min-w-44">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{a.account_name}</span>
                        {a.name_verified && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                            <svg
                              className="h-2.5 w-2.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-slate-600 whitespace-nowrap">
                      {a.account_number}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{a.bank_name}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <form action={deleteWithdrawalAccount}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <button
                          type="submit"
                          className="px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:text-red-600"
                          aria-label={`Remove ${a.bank_name} account`}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200/80 p-5">
          <p className="mb-4 text-xs text-slate-500">
            Where your money goes when you withdraw. The account must be in your own name.
          </p>
          <AddAccountForm profileName={profile.full_name} banks={banks} />
        </div>
      </Card>
    </div>
  );
}
