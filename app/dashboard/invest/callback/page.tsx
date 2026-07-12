/**
 * PAYMENT CALLBACK — where Paystack redirects the browser after checkout.
 *
 * ⚠️ This page NEVER credits money by itself trusting the redirect. It
 * re-verifies the reference with Paystack's API server-side and (because the
 * webhook may not have arrived yet) calls the same idempotent
 * apply_paid_investment() function — so whichever of webhook/callback runs
 * first applies the payment exactly once, and a faked redirect does nothing.
 */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { paystackVerify } from "@/lib/paystack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ERRORS } from "@/lib/errors";
import { fmtNaira } from "@/lib/format";

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const reference = params.reference ?? params.trxref ?? "";

  let ok = false;
  let amount = 0;
  let poolStatus: string | null = null;

  if (reference) {
    const admin = createSupabaseAdminClient();

    // Only look at references that belong to THIS user — someone pasting
    // another user's reference into the URL learns and triggers nothing new.
    const { data: investment } = await admin
      .from("investments")
      .select("id, amount, status, user_id")
      .eq("paystack_reference", reference)
      .eq("user_id", user.id)
      .single();

    if (investment) {
      amount = Number(investment.amount);

      if (investment.status === "paid") {
        ok = true; // webhook already handled it
      } else if (investment.status === "pending_payment") {
        // Webhook hasn't landed yet — verify + apply ourselves (idempotent).
        const verification = await paystackVerify(reference);
        if (verification.ok && verification.paid) {
          const { data } = await admin.rpc("apply_paid_investment", {
            p_reference: reference,
            p_amount_kobo: verification.amountKobo,
          });
          const result = data as { ok?: boolean; pool_status?: string } | null;
          ok = Boolean(result?.ok);
          poolStatus = result?.pool_status ?? null;
        }
      }
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        {ok ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mb-2">Investment confirmed!</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your payment of <span className="font-bold text-slate-900">{fmtNaira(amount)}</span> has been
              added to the pool.
              {poolStatus === "active" && (
                <span className="block mt-2 text-green-600 font-semibold">
                  🎉 The pool is now full — your investment has started!
                </span>
              )}
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
            <p className="text-sm text-slate-500 leading-relaxed">{ERRORS.PAYMENT_NOT_CONFIRMED}</p>
          </>
        )}

        <div className="flex gap-3 justify-center mt-7">
          <Link href="/dashboard/portfolio" className="px-5 py-2.5 bg-[#0d2137] text-white text-sm font-bold rounded-xl hover:bg-[#16365a] transition-colors">
            View portfolio
          </Link>
          <Link href="/dashboard" className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
