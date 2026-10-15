/**
 * ADMIN → PAYOUTS — the weekly schedule generated when a pool fills.
 *
 * Payouts settle themselves on their due date (app/api/cron/payouts), so this
 * page is for watching that it happened and stepping in when it should not
 * have: anything overdue that the schedule has not picked up yet, and a way to
 * take back a payout that was wrong.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SettleNowButton,
  RevertPayoutButton,
  RestorePayoutButton,
} from "@/components/admin/PayoutActions";
import { fmtNaira, fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Payouts · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

type PayoutRow = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  reverted_at: string | null;
  admin_note: string | null;
  user: { full_name: string | null; email: string | null } | null;
  pool: { name: string } | null;
  reverter: { full_name: string | null } | null;
};

const SELECT =
  "id, amount, due_date, status, paid_at, reverted_at, admin_note, user:profiles!payouts_user_id_fkey(full_name, email), pool:pools(name), reverter:profiles!payouts_reverted_by_fkey(full_name)";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

/** One payout list. Columns are the same everywhere; only the date and the
 *  available action change between sections. */
function Table({
  rows,
  empty,
  dateLabel,
  dateOf,
  action,
}: {
  rows: PayoutRow[];
  empty: string;
  dateLabel: string;
  dateOf: (p: PayoutRow) => string;
  action?: (p: PayoutRow) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-sm text-slate-500 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/80">
            <th className={th}>Investor</th>
            <th className={th}>Pool</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th}>{dateLabel}</th>
            {action && <th className={th}></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
              <td className={`${td} min-w-48`}>
                <p className="text-sm font-bold text-slate-900">{p.user?.full_name || "—"}</p>
                <p className="text-xs text-slate-500">{p.user?.email || "—"}</p>
                {p.admin_note && (
                  <p className="text-xs text-red-600 mt-1">
                    {p.admin_note}
                    {p.reverter?.full_name && (
                      <span className="text-slate-400"> · by {p.reverter.full_name}</span>
                    )}
                  </p>
                )}
              </td>
              <td className={`${td} text-xs text-slate-600 min-w-36`}>{p.pool?.name || "—"}</td>
              <td className={`${td} text-right text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap`}>
                {fmtNaira(p.amount)}
              </td>
              <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>{dateOf(p)}</td>
              {action && <td className={td}>{action(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default async function AdminPayoutsPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const startOfRun = new Date();
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const today = isoDay(startOfRun);
  const inSevenDays = isoDay(new Date(startOfRun.getTime() + 7 * 864e5));

  const [
    { data: overdue, error: overdueError },
    { data: upcoming },
    { data: settled },
    { data: reverted },
    { data: allRows },
  ] = await Promise.all([
      // Due but not yet settled — normally empty; anything here means the
      // schedule has not run since the date passed.
      admin
        .from("payouts")
        .select(SELECT)
        .eq("status", "scheduled")
        .lte("due_date", today)
        .order("due_date", { ascending: true }),
      admin
        .from("payouts")
        .select(SELECT)
        .eq("status", "scheduled")
        .gt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(40),
      admin
        .from("payouts")
        .select(SELECT)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(40),
      admin
        .from("payouts")
        .select(SELECT)
        .eq("status", "reverted")
        .order("reverted_at", { ascending: false })
        .limit(20),
      admin.from("payouts").select("amount, status, due_date"),
    ]);

  // The embeds name their foreign key because payouts now points at profiles
  // twice (user_id and reverted_by). Until migrate-auto-payouts.sql has run,
  // reverted_by does not exist and every query here fails — log it rather than
  // rendering an empty page that looks like "no payouts".
  if (overdueError) console.error("[admin] payouts query failed", overdueError);

  const rows = (allRows ?? []) as Array<{ amount: number; status: string; due_date: string }>;
  const sum = (f: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(f).reduce((s, r) => s + Number(r.amount), 0);

  const totals = {
    paid: sum((r) => r.status === "paid"),
    scheduled: sum((r) => r.status === "scheduled"),
    reverted: sum((r) => r.status === "reverted"),
    nextSeven: sum(
      (r) =>
        r.status === "scheduled" &&
        r.due_date > today &&
        r.due_date <= inSevenDays
    ),
  };

  const overdueRows = (overdue ?? []) as unknown as PayoutRow[];
  const overdueTotal = overdueRows.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Payouts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Payouts credit each investor automatically on their due date. This page is for
            checking that, and for taking one back if it was wrong.
          </p>
        </div>
        <SettleNowButton dueCount={overdueRows.length} />
      </div>

      {/* ── TOTALS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: "Paid to date", value: fmtNaira(totals.paid), tone: "text-green-600" },
          { label: "Still scheduled", value: fmtNaira(totals.scheduled), tone: "text-slate-900" },
          { label: "Due next 7 days", value: fmtNaira(totals.nextSeven), tone: "text-amber-600" },
          { label: "Reverted", value: fmtNaira(totals.reverted), tone: "text-red-500" },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1 leading-tight`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── OVERDUE ── */}
      <section>
        <div
          className={`rounded-2xl border px-5 py-4 mb-3 ${
            overdueRows.length === 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
          }`}
        >
          <p
            className={`text-sm font-extrabold ${
              overdueRows.length === 0 ? "text-green-800" : "text-amber-900"
            }`}
          >
            {overdueRows.length === 0
              ? "Everything due has been paid"
              : `${overdueRows.length} payout${overdueRows.length === 1 ? "" : "s"} past due — ${fmtNaira(overdueTotal)}`}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              overdueRows.length === 0 ? "text-green-700/80" : "text-amber-800/90"
            }`}
          >
            {overdueRows.length === 0
              ? "The daily run has settled every payout that reached its date."
              : "These reached their date but have not settled. The daily run will pick them up, or settle them now."}
          </p>
        </div>

        {overdueRows.length > 0 && (
          <Card className="overflow-hidden">
            <Table
              rows={overdueRows}
              empty=""
              dateLabel="Was due"
              dateOf={(p) => fmtDate(p.due_date)}
            />
          </Card>
        )}
      </section>

      {/* ── RECENTLY PAID ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">
          Recently paid
        </h2>
        <Card className="overflow-hidden">
          <Table
            rows={(settled ?? []) as unknown as PayoutRow[]}
            empty="Nothing has been paid yet."
            dateLabel="Paid"
            dateOf={(p) => fmtDateTime(p.paid_at ?? p.due_date)}
            action={(p) => <RevertPayoutButton payoutId={p.id} />}
          />
        </Card>
      </section>

      {/* ── REVERTED ── */}
      {(reverted ?? []).length > 0 && (
        <section>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">Reverted</h2>
          <Card className="overflow-hidden">
            <Table
              rows={(reverted ?? []) as unknown as PayoutRow[]}
              empty=""
              dateLabel="Reverted"
              dateOf={(p) => fmtDateTime(p.reverted_at ?? p.due_date)}
              action={(p) => <RestorePayoutButton payoutId={p.id} />}
            />
          </Card>
        </section>
      )}

      {/* ── UPCOMING ── */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-3">Coming up</h2>
        <Card className="overflow-hidden">
          <Table
            rows={(upcoming ?? []) as unknown as PayoutRow[]}
            empty="Nothing scheduled — no pool is running yet."
            dateLabel="Due"
            dateOf={(p) => fmtDate(p.due_date)}
          />
        </Card>
      </section>
    </div>
  );
}
