import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaymentSettings } from "@/lib/settings";
import { ManualTransferPanel, KorapayPanel } from "@/components/dashboard/wallet";
import { fmtNaira } from "@/lib/format";

export const metadata = { title: "Deposit · Rydvest" };

export default async function DepositPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [settings, { data: balance }, { data: profile }] = await Promise.all([
    getPaymentSettings(),
    supabase.rpc("my_available_balance"),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Deposit</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add money to your Rydvest balance, then use it to join any pool.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#0d2137] via-[#122c4b] to-[#16365a] p-6 sm:p-7 shadow-xl shadow-[#0d2137]/25">
        <div
          className="hidden sm:block absolute -top-16 -right-16 w-64 h-64 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(250,204,21,0.14) 0%, transparent 68%)" }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold text-white/45 uppercase tracking-[0.18em] mb-2">
              Available balance
            </p>
            <p className="text-4xl sm:text-5xl leading-none font-extrabold text-white tabular-nums tracking-[-0.03em]">
              {fmtNaira(Number(balance ?? 0))}
            </p>
          </div>
          <Link
            href="#deposit"
            className="shrink-0 text-center px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-2xl transition-all duration-150 shadow-lg shadow-amber-400/25"
          >
            Deposit
          </Link>
        </div>
      </div>

      <div id="deposit" className="scroll-mt-24">
        {settings.method === "manual" ? (
          <ManualTransferPanel
            bankName={settings.bankName}
            accountName={settings.accountName}
            accountNumber={settings.accountNumber}
            profileName={profile?.full_name ?? ""}
          />
        ) : (
          <KorapayPanel />
        )}
      </div>

      <Link
        href="/dashboard/history"
        className="group flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-slate-300 transition-colors"
      >
        <div>
          <p className="text-sm font-bold text-slate-900">Transaction history</p>
          <p className="text-xs text-slate-500 mt-0.5">Every deposit, investment and payout</p>
        </div>
        <span className="text-slate-300 group-hover:text-amber-500 transition-colors" aria-hidden>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
