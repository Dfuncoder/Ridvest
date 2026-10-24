/**
 * SECURITY — changing the password, and the record of who has been signing in.
 *
 * Its own page rather than a panel on Profile: Profile is a record of who you
 * are, and these are the two things somebody may need in a hurry, from a
 * phone, after an email told them to look.
 *
 * The sign-in list is read under RLS with the user's own session, so the
 * policy — your rows or an admin's view of them — is what decides what
 * appears here, not this query.
 */
import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Password & security · Rydvest" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

type SignInRow = {
  id: number;
  ip: string | null;
  location: string | null;
  device: string | null;
  new_ip: boolean;
  new_device: boolean;
  created_at: string;
};

export default async function SecurityPage() {
  const user = await requireUser();
  const profile = await getProfile();

  const supabase = await createSupabaseServerClient();
  const { data: signIns } = await supabase
    .from("sign_in_events")
    .select("id, ip, location, device, new_ip, new_device, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (signIns ?? []) as SignInRow[];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Password &amp; security</h1>
        <p className="text-sm text-slate-500">Signed in as {profile?.email ?? user.email}.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-slate-900">Change password</h2>
        <ChangePasswordForm />
      </div>

      {/* ── RECENT SIGN-INS ──
          The point of this list is recognition: you know your own phone and
          your own city at a glance, and a line that is neither is worth
          acting on. Anything first-seen is marked, because that is the only
          row worth reading twice. */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-200/80 px-5 py-3.5">
          <h2 className="text-sm font-extrabold text-slate-900">Recent sign-ins</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            The last 10, kept for 90 days. Times are West Africa Time.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nothing recorded yet. This fills up from your next sign-in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-left">
              <thead>
                <tr className="border-b border-slate-200/80">
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>When</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>Device</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>Location</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>IP address</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 odd:bg-slate-50/60">
                    <td className="px-5 py-3.5 align-middle text-sm font-semibold whitespace-nowrap text-slate-900">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-5 py-3.5 align-middle text-sm text-slate-700">
                      <span className="min-w-0 wrap-break-word">{r.device || "—"}</span>
                      {r.new_device && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
                          First seen
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-middle text-sm text-slate-700">
                      {r.location || "—"}
                    </td>
                    <td className="px-5 py-3.5 align-middle text-sm tabular-nums text-slate-700">
                      {r.ip || "—"}
                      {r.new_ip && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-slate-200/80 px-5 py-3.5 text-xs leading-relaxed text-slate-500">
          See something you don&apos;t recognise? Change your password above and email{" "}
          <a href="mailto:support@rydvest.com" className="font-semibold text-slate-900 hover:underline">
            support@rydvest.com
          </a>{" "}
          straight away. A sign-in on a different network is normal when you travel or switch
          between wifi and mobile data.
        </p>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Forgotten your password?{" "}
        <Link href="/forgot-password" className="font-semibold text-slate-900 hover:underline">
          Get a reset link by email
        </Link>
        . Your transaction PIN is separate and lives on your{" "}
        <Link href="/dashboard/profile" className="font-semibold text-slate-900 hover:underline">
          profile
        </Link>
        .
      </p>
    </div>
  );
}
