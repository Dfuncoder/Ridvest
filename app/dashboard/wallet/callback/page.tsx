/**
 * Where Korapay returns the browser after checkout.
 *
 * The redirect itself is never trusted. We re-verify the reference with
 * Korapay server-side and call the same idempotent apply_paid_deposit() the
 * webhook uses, so whichever arrives first credits exactly once and a faked
 * redirect credits nothing.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { korapayVerify } from "@/lib/korapay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ERRORS } from "@/lib/errors";
import { fmtNaira } from "@/lib/format";

export default async function WalletCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const reference = params.reference ?? "";

  let credited = false;
  let amount = 0;

  if (reference) {
    const admin = createSupabaseAdminClient();

    // Only references belonging to THIS user — pasting someone else's
    // reference reveals nothing and triggers nothing.
    const { data: deposit } = await admin
      .from("deposits")
      .select("id, amount, credited_amount, status")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .single();

    if (deposit) {
      amount = Number(deposit.credited_amount ?? deposit.amount);

      if (deposit.status === "credited") {
        credited = true;
      } else if (deposit.status === "pending") {
        const verification = await korapayVerify(reference);
        if (verification.ok && verification.paid) {
          const { data } = await admin.rpc("apply_paid_deposit", {
            p_reference: reference,
            p_amount_kobo: verification.amountKobo,
          });
          const result = data as { ok?: boolean; amount?: number } | null;
          credited = Boolean(result?.ok);
          if (result?.amount) amount = Number(result.amount);
        }
      }
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        {credited ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mb-2">Balance topped up</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-900">{fmtNaira(amount)}</span> has been added to
              your Rydvest balance. You can join a pool with it right away.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mb-2">Payment pending</h1>
            <p className="text-sm text-slate-500 leading-relaxed">{ERRORS.DEPOSIT_NOT_CONFIRMED}</p>
          </>
        )}

        <div className="flex gap-3 justify-center mt-7">
          <Link href="/dashboard/invest" className="px-5 py-2.5 bg-[#0d2137] text-white text-sm font-bold rounded-xl hover:bg-[#16365a] transition-colors">
            Invest now
          </Link>
          <Link href="/dashboard/wallet" className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
            Back to wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
