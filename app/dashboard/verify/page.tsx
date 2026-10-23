/**
 * VERIFICATION — where a user proves who they are before withdrawing.
 *
 * Four states, one per card: nothing sent yet, waiting on us, turned down
 * (with the reason, and the form again), or done.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SelfieCapture from "@/components/dashboard/SelfieCapture";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Verification · Rydvest" };

/** The stored number is encrypted; only these four digits are in the clear. */
function maskId(last4: string): string {
  return `${"•".repeat(7)}${last4}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl ${className}`}>{children}</div>
  );
}

export default async function VerifyPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // RLS limits this to the user's own rows.
  const { data: submissions } = await supabase
    .from("kyc_submissions")
    .select("id, id_type, id_number_last4, status, admin_note, created_at, reviewed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = submissions ?? [];
  const approved = rows.find((r) => r.status === "approved");
  const pending = rows.find((r) => r.status === "pending");
  const rejected = rows.find((r) => r.status === "rejected");

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Verification</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Confirm your identity to unlock withdrawals.
        </p>
      </div>

      {/* ── DONE ── */}
      {approved ? (
        <Card className="p-6">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-500/10">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">You&apos;re verified</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Withdrawals are open on your account.
              </p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {approved.id_type.toUpperCase()}
                  </dt>
                  <dd className="font-semibold text-slate-900 tabular-nums">
                    {maskId(approved.id_number_last4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Confirmed
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {approved.reviewed_at ? fmtDateTime(approved.reviewed_at) : "—"}
                  </dd>
                </div>
              </dl>
              <Link
                href="/dashboard/payouts"
                className="mt-5 inline-block rounded-xl bg-[#0d2137] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#14314f]"
              >
                Go to Withdraw
              </Link>
            </div>
          </div>
        </Card>
      ) : pending ? (
        /* ── WAITING ON US ── */
        <Card className="p-6">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/10">
              <svg
                className="h-5 w-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">
                Your details are with us
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                This usually takes a few minutes. We&apos;ll email you as soon as it&apos;s done.
              </p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {pending.id_type.toUpperCase()}
                  </dt>
                  <dd className="font-semibold text-slate-900 tabular-nums">
                    {maskId(pending.id_number_last4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Sent
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {fmtDateTime(pending.created_at)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>
      ) : (
        /* ── NOT SENT, OR TURNED DOWN ── */
        <>
          {rejected && (
            <Card className="border-red-200 bg-red-50/60 p-5">
              <h2 className="text-sm font-extrabold text-red-700">
                Your last submission was not accepted
              </h2>
              {rejected.admin_note && (
                <p className="mt-1.5 text-sm leading-relaxed text-red-700/90">
                  {rejected.admin_note}
                </p>
              )}
              <p className="mt-2 text-xs text-red-700/70">
                Fix that and send it again below.
              </p>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-base font-extrabold text-slate-900">Verify your identity</h2>
            <p className="mt-0.5 mb-5 text-sm text-slate-500">
              Two things: your NIN, and a photo taken on this device. It usually takes a few minutes.
            </p>
            <SelfieCapture />
          </Card>

          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            Your NIN and your photo are used only to confirm your identity and are never
            shown to other members.
          </p>
        </>
      )}
    </div>
  );
}
