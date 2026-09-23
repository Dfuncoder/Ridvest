/**
 * HISTORY — every money event on the account, newest first.
 *
 * Deposits are read from `deposits` rather than `transactions` so a transfer
 * still waiting on confirmation appears here too; everything else comes from
 * the ledger. Both are scoped to the caller by RLS.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtNaira, fmtDate } from "@/lib/format";

export const metadata = { title: "History · Rydvest" };

type Entry = {
  id: string;
  kind: "deposit" | "investment" | "payout" | "withdrawal" | "refund";
  label: string;
  amount: number | null;
  at: string;
  status: "done" | "pending" | "failed";
  statusLabel: string;
  note?: string | null;
};

const KIND_STYLE: Record<Entry["kind"], { tint: string; sign: string; icon: React.ReactNode }> = {
  deposit: {
    tint: "bg-green-500/10 text-green-600 border-green-500/20",
    sign: "+",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6-6m-6 6l-6-6" />,
  },
  payout: {
    tint: "bg-green-500/10 text-green-600 border-green-500/20",
    sign: "+",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />,
  },
  investment: {
    tint: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    sign: "−",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />,
  },
  withdrawal: {
    tint: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    sign: "−",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l-6 6m6-6l6 6" />,
  },
  refund: {
    tint: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    sign: "+",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />,
  },
};

const STATUS_STYLE: Record<Entry["status"], string> = {
  done: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default async function HistoryPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: deposits }, { data: ledger }] = await Promise.all([
    supabase
      .from("deposits")
      .select("id, amount, credited_amount, method, status, admin_note, created_at, credited_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("transactions")
      .select("id, type, amount, status, created_at, metadata")
      .neq("type", "deposit")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const entries: Entry[] = [
    ...(deposits ?? []).map((d): Entry => {
      const amount = d.credited_amount ?? d.amount;
      return {
        id: `dep-${d.id}`,
        kind: "deposit",
        label: d.method === "manual" ? "Bank transfer" : "Card / online deposit",
        amount: amount === null ? null : Number(amount),
        at: d.credited_at ?? d.created_at,
        status: d.status === "credited" ? "done" : d.status === "rejected" ? "failed" : "pending",
        statusLabel:
          d.status === "credited"
            ? "Credited"
            : d.status === "rejected"
              ? "Not confirmed"
              : "Processing",
        note: d.status === "rejected" ? d.admin_note : null,
      };
    }),
    ...(ledger ?? []).map((t): Entry => {
      const kind = t.type as Entry["kind"];
      return {
        id: `txn-${t.id}`,
        kind,
        label:
          kind === "investment"
            ? "Pool investment"
            : kind === "payout"
              ? "Weekly payout"
              : kind === "withdrawal"
                ? "Withdrawal"
                : "Refund",
        amount: Number(t.amount),
        at: t.created_at,
        status: t.status === "success" ? "done" : t.status === "failed" ? "failed" : "pending",
        statusLabel:
          t.status === "success" ? "Completed" : t.status === "failed" ? "Failed" : "Pending",
      };
    }),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">History</h1>
        <p className="text-sm text-slate-500 mt-1">Every movement on your account, newest first.</p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">
            Nothing here yet. Your deposits and payouts will appear in this list.
          </p>
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {entries.map((e) => {
            const style = KIND_STYLE[e.kind] ?? KIND_STYLE.refund;
            return (
              <li key={e.id} className="flex items-center gap-4 px-4 sm:px-5 py-4">
                <span
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${style.tint}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {style.icon}
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{e.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fmtDate(e.at)}</p>
                  {e.note && <p className="text-xs text-red-600 mt-1">{e.note}</p>}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                    {e.amount === null ? "—" : `${style.sign}${fmtNaira(e.amount)}`}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[e.status]}`}
                  >
                    {e.statusLabel}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
