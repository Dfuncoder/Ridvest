/**
 * ADMIN → TRANSFERS — every movement of balance between accounts.
 *
 * The code stops the technical attacks: overdrawing, racing two requests,
 * sweeping the account-ID space, sending from or to a locked account. What it
 * cannot judge is intent. A transfer from a scammed user to their scammer is
 * indistinguishable, request by request, from paying a friend back.
 *
 * So this page is not only a log. It reads the whole recent set and surfaces
 * the SHAPES that fraud makes and ordinary use does not:
 *
 *   • fan-in     — many different people paying one account (a collection
 *                  point: mule accounts, fake investment schemes)
 *   • fan-out    — one account paying many different people (distribution
 *                  after a takeover, or splitting to stay under limits)
 *   • pass-through — money arriving and leaving again almost at once, which is
 *                  what layering looks like and what saving does not
 *   • velocity   — an unusual number of transfers in a day
 *   • probing    — repeated failed account-ID lookups, i.e. guessing
 *
 * None of these is proof of anything. They are the accounts worth a human
 * looking at, which is the whole job of this screen.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fmtNaira, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Transfers · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = `px-4 py-3 ${eyebrow} text-slate-400 whitespace-nowrap`;
const td = "px-4 py-3.5 align-top";

/** How many transfers to read. Everything on this page is computed from them. */
const WINDOW = 1000;

/**
 * Thresholds for "worth a look". Deliberately loose — this list is meant to be
 * short enough that somebody actually reads it, not to catch everything.
 */
const FLAG = {
  /** Distinct people paying one account within the window. */
  fanIn: 5,
  /** Distinct people one account has paid within the window. */
  fanOut: 5,
  /** Transfers sent by one account in 24 hours. */
  velocity: 6,
  /** Minutes between money arriving and leaving again to count as pass-through. */
  passThroughMinutes: 60,
  /** Failed account-ID lookups in 24 hours. */
  probes: 10,
};

type Party = { id: string; full_name: string | null; user_code: string | null } | null;

type TransferRow = {
  id: string;
  amount: number;
  fee: number;
  note: string | null;
  reference: string;
  created_at: string;
  sender: Party;
  recipient: Party;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

function PartyCell({ party }: { party: Party }) {
  if (!party) return <span className="text-slate-400">—</span>;
  return (
    <Link href={`/admin/users/${party.id}`} className="group block min-w-0">
      <p className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-amber-600">
        {party.full_name ?? "—"}
      </p>
      <p className="font-mono text-[10px] text-slate-400">{party.user_code ?? ""}</p>
    </Link>
  );
}

export default async function AdminTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // transfers has two foreign keys into profiles, so both embeds must name
  // their constraint — an ambiguous embed fails the whole query.
  const select =
    "id, amount, fee, note, reference, created_at, " +
    "sender:profiles!transfers_sender_id_fkey(id, full_name, user_code), " +
    "recipient:profiles!transfers_recipient_id_fkey(id, full_name, user_code)";

  const [{ data: raw, error }, { count: totalCount }, { data: lookups }] = await Promise.all([
    admin
      .from("transfers")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(WINDOW),
    admin.from("transfers").select("id", { count: "exact", head: true }),
    admin
      .from("code_lookups")
      .select("user_id, found, created_at")
      .eq("found", false)
      // eslint-disable-next-line react-hooks/purity -- server render, read once
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
  ]);

  if (error) console.error("[admin] transfers query failed", error);

  const all = (raw ?? []) as unknown as TransferRow[];

  // ── The numbers ──────────────────────────────────────────────────────────
  // This is an async Server Component: it runs once per request, so the clock
  // is read once and the value is stable for the whole render. The purity rule
  // is written for client components, where a re-render would change it.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = Date.now() - 24 * 3600_000;
  const recent = all.filter((t) => new Date(t.created_at).getTime() >= dayAgo);
  const movedAll = all.reduce((s, t) => s + Number(t.amount), 0);
  const movedDay = recent.reduce((s, t) => s + Number(t.amount), 0);
  const feesAll = all.reduce((s, t) => s + Number(t.fee ?? 0), 0);

  // ── The shapes ───────────────────────────────────────────────────────────
  const sentBy = new Map<string, TransferRow[]>();
  const receivedBy = new Map<string, TransferRow[]>();
  const names = new Map<string, Party>();

  for (const t of all) {
    if (t.sender) {
      names.set(t.sender.id, t.sender);
      sentBy.set(t.sender.id, [...(sentBy.get(t.sender.id) ?? []), t]);
    }
    if (t.recipient) {
      names.set(t.recipient.id, t.recipient);
      receivedBy.set(t.recipient.id, [...(receivedBy.get(t.recipient.id) ?? []), t]);
    }
  }

  const probesBy = new Map<string, number>();
  for (const l of lookups ?? []) {
    probesBy.set(l.user_id, (probesBy.get(l.user_id) ?? 0) + 1);
  }

  const flags = new Map<string, string[]>();
  const addFlag = (userId: string, reason: string) =>
    flags.set(userId, [...(flags.get(userId) ?? []), reason]);

  for (const [userId, rows] of receivedBy) {
    const distinct = new Set(rows.map((t) => t.sender?.id).filter(Boolean)).size;
    if (distinct >= FLAG.fanIn) addFlag(userId, `paid by ${distinct} different people`);
  }

  for (const [userId, rows] of sentBy) {
    const distinct = new Set(rows.map((t) => t.recipient?.id).filter(Boolean)).size;
    if (distinct >= FLAG.fanOut) addFlag(userId, `has paid ${distinct} different people`);

    const inDay = rows.filter((t) => new Date(t.created_at).getTime() >= dayAgo).length;
    if (inDay >= FLAG.velocity) addFlag(userId, `${inDay} transfers in 24 hours`);
  }

  // Pass-through: money in, then money out within the window. Counted per
  // incoming transfer so one quick turnaround does not read the same as ten.
  for (const [userId, incoming] of receivedBy) {
    const outgoing = sentBy.get(userId) ?? [];
    if (outgoing.length === 0) continue;

    let hops = 0;
    for (const got of incoming) {
      const gotAt = new Date(got.created_at).getTime();
      const passedOn = outgoing.some((sent) => {
        const sentAt = new Date(sent.created_at).getTime();
        return sentAt > gotAt && sentAt - gotAt <= FLAG.passThroughMinutes * 60_000;
      });
      if (passedOn) hops += 1;
    }
    if (hops >= 2) addFlag(userId, `passed money straight on ${hops} times`);
  }

  for (const [userId, count] of probesBy) {
    if (count >= FLAG.probes) addFlag(userId, `${count} failed ID lookups in 24 hours`);
  }

  const watchList = [...flags.entries()]
    .map(([userId, reasons]) => ({
      user: names.get(userId) ?? null,
      userId,
      reasons,
      sent: (sentBy.get(userId) ?? []).reduce((s, t) => s + Number(t.amount), 0),
      received: (receivedBy.get(userId) ?? []).reduce((s, t) => s + Number(t.amount), 0),
    }))
    .sort((a, b) => b.reasons.length - a.reasons.length || b.sent - a.sent);

  // ── The list ─────────────────────────────────────────────────────────────
  const needle = query.toLowerCase();
  const rows = query
    ? all.filter((t) => {
        const hay = [
          t.sender?.full_name,
          t.sender?.user_code,
          t.recipient?.full_name,
          t.recipient?.user_code,
          t.reference,
          t.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
    : all;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Transfers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Money moved between accounts, and the accounts whose pattern is worth a look.
        </p>
      </div>

      {/* ── COUNTS ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {[
          { label: "Transfers", value: String(totalCount ?? 0), tone: "text-slate-900" },
          { label: "Moved", value: fmtNaira(movedAll), tone: "text-slate-900" },
          { label: "Last 24h", value: String(recent.length), tone: "text-slate-900" },
          {
            label: "Moved in 24h",
            value: fmtNaira(movedDay),
            tone: movedDay > 0 ? "text-amber-600" : "text-slate-300",
          },
          // Fees over the same window as everything else on this page, so the
          // figure reconciles with the rows below rather than with all time.
          { label: "Fees earned", value: fmtNaira(feesAll), tone: "text-green-600" },
        ].map((t) => (
          <Card key={t.label} className="min-w-0 px-3 py-3.5 sm:px-4">
            <p className={`${eyebrow} text-slate-400 mb-1`}>{t.label}</p>
            <p className={`truncate text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── WORTH A LOOK ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Worth a look</h2>
            <p className="text-xs text-slate-500">
              Patterns, not proof. Open the account before acting on any of it.
            </p>
          </div>
          <span
            className={`${eyebrow} shrink-0 rounded-full border px-2.5 py-1 ${
              watchList.length
                ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                : "border-green-500/20 bg-green-500/10 text-green-600"
            }`}
          >
            {watchList.length || "None"}
          </span>
        </div>

        {watchList.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Nothing stands out in the last {WINDOW.toLocaleString()} transfers.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className={th}>Account</th>
                  <th className={th}>Why</th>
                  <th className={`${th} text-right`}>Sent</th>
                  <th className={`${th} text-right`}>Received</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {watchList.map((w) => (
                  <tr key={w.userId} className="bg-amber-50/40">
                    <td className={`${td} min-w-44`}>
                      <PartyCell party={w.user} />
                    </td>
                    <td className={`${td} min-w-64`}>
                      <ul className="flex flex-col gap-1">
                        {w.reasons.map((r) => (
                          <li key={r} className="text-xs text-slate-700">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-900`}>
                      {fmtNaira(w.sent)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-sm font-bold tabular-nums text-green-600`}>
                      {fmtNaira(w.received)}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <Link
                        href={`/admin/users/${w.userId}`}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── SEARCH ── */}
      <form className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search name, account ID, reference or note"
          className="flex-1 min-w-0 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-200/40 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-slate-800"
        >
          Search
        </button>
        {query && (
          <Link
            href="/admin/transfers"
            className="flex shrink-0 items-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── EVERY TRANSFER ── */}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : "No transfers yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className={th}>When</th>
                  <th className={th}>From</th>
                  <th className={th}>To</th>
                  <th className={`${th} hidden lg:table-cell`}>Note</th>
                  <th className={`${th} hidden xl:table-cell`}>Reference</th>
                  <th className={`${th} text-right`}>Fee</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                    <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>
                      {fmtDateTime(t.created_at)}
                    </td>
                    <td className={`${td} min-w-40`}>
                      <PartyCell party={t.sender} />
                    </td>
                    <td className={`${td} min-w-40`}>
                      <PartyCell party={t.recipient} />
                    </td>
                    <td className={`${td} hidden max-w-56 lg:table-cell text-xs text-slate-500`}>
                      {t.note || "—"}
                    </td>
                    <td className={`${td} hidden xl:table-cell font-mono text-[10px] text-slate-400`}>
                      {t.reference}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-xs tabular-nums text-green-600`}>
                      {fmtNaira(t.fee ?? 0)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-sm font-extrabold tabular-nums text-slate-900`}>
                      {fmtNaira(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        Reading the {WINDOW.toLocaleString()} most recent transfers
        {query ? ` · ${rows.length} match "${query}"` : ""}. Totals and the watch list are computed
        from that set.
      </p>
    </div>
  );
}
