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
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Deposit</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Add money, then use it to join any pool.
          </p>
        </div>
      </div>

      {/* Deliberately compact: the action below it has to stay above the fold. */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#0d2137] via-[#122c4b] to-[#16365a] px-5 py-4 shadow-lg shadow-[#0d2137]/20">
        <div
          className="hidden sm:block absolute -top-12 -right-12 w-48 h-48 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(250,204,21,0.14) 0%, transparent 68%)" }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-white/45 uppercase tracking-[0.16em] mb-1">
              Available balance
            </p>
            <p className="text-2xl sm:text-3xl leading-none font-extrabold text-white tabular-nums tracking-[-0.02em]">
              {fmtNaira(Number(balance ?? 0))}
            </p>
          </div>
          <Link
            href="/dashboard/history"
            className="shrink-0 text-[11px] font-bold text-white/55 hover:text-white transition-colors whitespace-nowrap"
          >
            History →
          </Link>
        </div>
      </div>

      <div>
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
    </div>
  );
}
