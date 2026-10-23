/**
 * VERIFY OTP — the 6-digit code emailed by Supabase Auth when an account is
 * created.
 *
 * A server component, and that is the security of it. The address being
 * confirmed is read here from a signed, http-only cookie set when the account
 * was created, so the page cannot be told what to display and the form has
 * nothing worth tampering with. The URL carries nothing at all.
 *
 * What this replaced: ?email= in the query string, which the page printed
 * verbatim and the resend button posted to the server. That let a crafted
 * link put any text on a real Rydvest page, and let anyone make us email a
 * stranger a signup code — with the reply revealing whether that stranger had
 * an account here.
 */
import Link from "next/link";
import { cookies } from "next/headers";
import { CONFIRM_COOKIE, readConfirm } from "@/lib/login-challenge";
import { AuthShell } from "@/components/auth/shared";
import OtpForm from "@/components/auth/OtpForm";

export const metadata = { title: "Confirm your email · Rydvest" };

export default async function OTPPage() {
  const jar = await cookies();
  const email = readConfirm(jar.get(CONFIRM_COOKIE)?.value);

  return (
    <AuthShell>
      {email ? (
        <OtpForm email={email} />
      ) : (
        /* No cookie, a tampered one, or one older than the code itself. */
        <div className="bg-[#0f2e52] border border-white/10 rounded-2xl p-7 text-center">
          <p className="text-sm text-slate-400 mb-4">
            We couldn&apos;t tell which email to confirm.
          </p>
          <Link
            href="/register"
            className="text-amber-400 font-semibold text-sm hover:text-amber-300"
          >
            Go back to registration →
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
