/**
 * HISTORY — every money event on the account as a statement.
 *
 * Deposits are read from `deposits` rather than `transactions` so a transfer
 * still waiting on confirmation appears here too; everything else comes from
 * the ledger. Both are scoped to the caller by RLS.
 *
 * A real <table> on desktop so figures line up in columns and the whole thing
 * can be copied or printed; stacked rows on phones, where four columns cannot
 * fit without truncating the amounts.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fmtNaira, fmtDateTime } from "@/lib/format";

export const metadata = { title: "History · Rydvest" };

type Kind = "deposit" | "investment" | "payout" | "withdrawal" | "refund";

type Entry = {
  id: string;
  kind: Kind;
  label: string;
  reference: string | null;
  amount: number | null;
  at: string;
  status: "done" | "pending" | "failed";
  statusLabel: string;
  note?: string | null;
};

/** "+" means it increased the balance, "−" means it left it. */
const KIND: Record<Kind, { sign: "+" | "−"; tint: string; icon: string }> = {
  deposit: {
    sign: "+",
    tint: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: "M12 4.5v15m0 0l6-6m-6 6l-6-6",
  },
  payout: {
    sign: "+",
    tint: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33",
  },
  investment: {
    sign: "−",
    tint: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  },
  withdrawal: {
    sign: "−",
    tint: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: "M12 19.5v-15m0 0l-6 6m6-6l6 6",
  },
  refund: {
    sign: "+",
    tint: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    icon: "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3",
  },
};

const STATUS: Record<Entry["status"], string> = {
  done: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

function KindIcon({ kind }: { kind: Kind }) {
  const k = KIND[kind] ?? KIND.refund;
  return (
    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${k.tint}`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={k.icon} />
      </svg>
    </span>
  );
}

function Amount({ entry }: { entry: Entry }) {
  if (entry.amount === null) {
    return <span className="text-slate-400">Awaiting confirmation</span>;
  }
  const k = KIND[entry.kind] ?? KIND.refund;
  return (
    <span className={k.sign === "+" ? "text-green-600" : "text-slate-900"}>
      {k.sign}
      {fmtNaira(entry.amount)}
    </span>
  );
}

function StatusPill({ entry }: { entry: Entry }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
        STATUS[entry.status]
      }`}
    >
      {entry.statusLabel}
    </span>
  );
}

export default async function HistoryPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: deposits }, { data: ledger }] = await Promise.all([
    supabase
      .from("deposits")
      .select(
        "id, amount, credited_amount, method, status, reference, admin_note, created_at, credited_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("transactions")
      .select("id, type, amount, status, reference, created_at")
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
        reference: d.reference,
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
      const kind = t.type as Kind;
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
        reference: t.reference,
        amount: Number(t.amount),
        at: t.created_at,
        status: t.status === "success" ? "done" : t.status === "failed" ? "failed" : "pending",
        statusLabel:
          t.status === "success" ? "Completed" : t.status === "failed" ? "Failed" : "Pending",
      };
    }),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  const credited = entries
    .filter((e) => e.status === "done" && (KIND[e.kind]?.sign ?? "+") === "+")
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  const debited = entries
    .filter((e) => e.status === "done" && KIND[e.kind]?.sign === "−")
    .reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">History</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every movement on your account, newest first.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 p-10 text-center">
          <p className="text-sm text-slate-500">
            Nothing here yet. Your deposits and payouts will appear in this list.
          </p>
        </div>
      ) : (
        <>
          {/* Totals, so the statement balances at a glance. */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "In", value: fmtNaira(credited), tone: "text-green-600" },
              { label: "Out", value: fmtNaira(debited), tone: "text-slate-900" },
              { label: "Entries", value: String(entries.length), tone: "text-slate-900" },
            ].map((t) => (
              <div
                key={t.label}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 px-4 py-3.5"
              >
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] mb-1">
                  {t.label}
                </p>
                <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
                  {t.value}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 overflow-hidden">
            {/* ── Desktop: a real table ── */}
            <table className="hidden sm:table w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                    Transaction
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                    Date
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <KindIcon kind={e.kind} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{e.label}</p>
                          {e.reference && (
                            <p className="font-mono text-[10px] text-slate-400 truncate max-w-[14rem]">
                              {e.reference}
                            </p>
                          )}
                          {e.note && <p className="text-xs text-red-600 mt-0.5">{e.note}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDateTime(e.at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill entry={e} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-extrabold tabular-nums whitespace-nowrap">
                      <Amount entry={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Mobile: stacked rows ── */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-4">
                  <KindIcon kind={e.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{e.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDateTime(e.at)}</p>
                    {e.note && <p className="text-xs text-red-600 mt-1">{e.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold tabular-nums whitespace-nowrap">
                      <Amount entry={e} />
                    </p>
                    <span className="inline-block mt-1">
                      <StatusPill entry={e} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
