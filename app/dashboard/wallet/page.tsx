import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaymentSettings } from "@/lib/settings";
import { ManualTransferPanel, KorapayPanel } from "@/components/dashboard/wallet";
import { fmtNaira, fmtDate } from "@/lib/format";

export const metadata = { title: "Fund account · Rydvest" };

type DepositStatus = "pending" | "awaiting_confirmation" | "credited" | "rejected";

const STATUS_STYLE: Record<DepositStatus, { label: string; className: string }> = {
  pending: {
    label: "Awaiting payment",
    className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
  awaiting_confirmation: {
    label: "Processing",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  credited: {
    label: "Credited",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  rejected: {
    label: "Not confirmed",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
};

export default async function WalletPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [settings, { data: balance }, { data: profile }, { data: deposits }] = await Promise.all([
    getPaymentSettings(),
    supabase.rpc("my_available_balance"),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("deposits")
      .select("id, amount, credited_amount, method, status, admin_note, created_at, credited_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const history = deposits ?? [];
  const awaiting = history.find((d) => d.status === "awaiting_confirmation");

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Fund account</h1>
        <p className="text-sm text-slate-500">
          Add money to your Rydvest balance, then use it to join any pool.
        </p>
      </div>

      <div className="bg-gradient-to-br from-[#0d2137] to-[#16365a] rounded-2xl p-6 shadow-xl shadow-[#0d2137]/20">
        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">
          Available balance
        </p>
        <p className="text-3xl font-extrabold text-white tabular-nums">
          {fmtNaira(Number(balance ?? 0))}
        </p>
      </div>

      {settings.method === "manual" ? (
        <ManualTransferPanel
          bankName={settings.bankName}
          accountName={settings.accountName}
          accountNumber={settings.accountNumber}
          profileName={profile?.full_name ?? ""}
          hasPending={Boolean(awaiting)}
        />
      ) : (
        <KorapayPanel />
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-extrabold text-slate-900">Funding history</h2>
        </div>

        {history.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            Nothing here yet. Your top-ups will show up in this list.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((d) => {
              const status = STATUS_STYLE[d.status as DepositStatus] ?? STATUS_STYLE.pending;
              const shown = d.credited_amount ?? d.amount;
              return (
                <li key={d.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {shown === null ? "Awaiting confirmation" : fmtNaira(Number(shown))}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {d.method === "manual" ? "Bank transfer" : "Card / online"} ·{" "}
                      {fmtDate(d.credited_at ?? d.created_at)}
                    </p>
                    {d.status === "rejected" && d.admin_note && (
                      <p className="text-xs text-red-600 mt-1.5">{d.admin_note}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.className}`}
                  >
                    {d.status === "awaiting_confirmation" && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5 align-middle" />
                    )}
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
