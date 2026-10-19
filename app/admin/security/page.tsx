/**
 * ADMIN → PASSWORD.
 *
 * The same form the users get, inside the console, so an admin never has to
 * leave the admin area to do the one thing that matters most for an account
 * that can move money and read verification documents.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const metadata = { title: "Password · Rydvest admin" };

export default async function AdminSecurityPage() {
  const { profile } = await requireAdmin();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Password</h1>
        <p className="text-sm text-slate-500">Signed in as {profile.email}.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
        <ChangePasswordForm />
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Everyone on the notification list is emailed whenever an admin account signs in, with the
        device and location.{" "}
        <Link href="/admin/settings" className="font-semibold text-slate-900 hover:underline">
          Manage that list
        </Link>
        .
      </p>
    </div>
  );
}
