/**
 * SECURITY — changing the account password.
 *
 * Its own page rather than a panel on Profile: Profile is a record of who you
 * are, and this is the one thing on the account that somebody may need to do
 * in a hurry, from a phone, after an email told them to.
 */
import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const metadata = { title: "Password · Rydvest" };

export default async function SecurityPage() {
  const user = await requireUser();
  const profile = await getProfile();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Password</h1>
        <p className="text-sm text-slate-500">
          Signed in as {profile?.email ?? user.email}.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <ChangePasswordForm />
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Forgotten the one you have?{" "}
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
