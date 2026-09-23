/**
 * The page behind the "confirm this transfer" link emailed to the team.
 *
 * The token in the URL identifies the deposit, but it does NOT authorize the
 * credit on its own — a forwarded email must not be able to move money. The
 * confirm button only works for a signed-in admin, and the token is cleared
 * once the deposit is settled, so each link works exactly once.
 */
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DepositActions } from "@/components/admin/DepositActions";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Confirm transfer · Rydvest admin" };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
        {children}
      </div>
    </div>
  );
}

export default async function ConfirmDepositPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getSessionUser();
  const admin = createSupabaseAdminClient();

  if (!user) {
    return (
      <Frame>
        <h1 className="text-lg font-extrabold text-slate-900 mb-2">Sign in to continue</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          You need to be signed in as a Rydvest admin to confirm a transfer. Signing in brings you
          straight back here.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/admin/deposits/confirm/${token}`)}`}
          className="block text-center py-3 bg-[#0d2137] text-white text-sm font-bold rounded-xl hover:bg-[#16365a] transition-colors"
        >
          Sign in
        </Link>
      </Frame>
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <Frame>
        <h1 className="text-lg font-extrabold text-slate-900 mb-2">Not available</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          This page is for Rydvest admins only.
        </p>
        <Link
          href="/dashboard"
          className="block text-center py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
        >
          Go to dashboard
        </Link>
      </Frame>
    );
  }

  const { data: deposit } = await admin
    .from("deposits")
    .select(
      "id, status, reference, created_at, user_id, profile:profiles(full_name, email, phone)"
    )
    .eq("confirm_token", token)
    .maybeSingle();

  if (!deposit) {
    return (
      <Frame>
        <h1 className="text-lg font-extrabold text-slate-900 mb-2">Already handled</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          This link has already been used, or the transfer was settled another way. Check the
          deposits page for its current status.
        </p>
        <Link
          href="/admin/deposits"
          className="block text-center py-3 bg-[#0d2137] text-white text-sm font-bold rounded-xl hover:bg-[#16365a] transition-colors"
        >
          Open deposits
        </Link>
      </Frame>
    );
  }

  const depositor = deposit.profile as unknown as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;

  const { data: accounts } = await admin
    .from("withdrawal_accounts")
    .select("bank_name, account_number, account_name")
    .eq("user_id", deposit.user_id);

  return (
    <Frame>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        Transfer to confirm
      </p>
      <p className="text-2xl font-extrabold text-slate-900 mb-5 break-words">
        {depositor?.full_name || depositor?.email || "Unknown user"}
      </p>

      <dl className="text-sm border-y border-slate-100 divide-y divide-slate-100 mb-5">
        {[
          ["Email", depositor?.email || "—"],
          ["Phone", depositor?.phone || "—"],
          ["Declared", fmtDate(deposit.created_at)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-semibold text-slate-900 text-right truncate">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          The sender must be one of these
        </p>
        {(accounts ?? []).length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
            This user has no bank account on file. Match on the name above, and ask them to add
            their account before the next transfer.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(accounts ?? []).map((a) => (
              <li
                key={a.account_number}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
              >
                <span className="font-bold text-slate-900 tabular-nums">{a.account_number}</span>
                <span className="text-slate-500"> · {a.bank_name}</span>
                <span className="block text-slate-500 mt-0.5">{a.account_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 mb-5">
        <p className="text-xs text-amber-900 leading-relaxed">
          Find the credit in the Rydvest account, check the sender matches, then enter the exact
          amount that landed. This cannot be undone from here.
        </p>
      </div>

      <DepositActions depositId={deposit.id} size="full" />

      <Link
        href="/admin/deposits"
        className="block text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mt-5"
      >
        See all deposits
      </Link>
    </Frame>
  );
}
