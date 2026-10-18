/**
 * ADMIN → REFUNDS — find a pool, see everyone in it, refund whoever needs it.
 *
 * The Investments list is the wrong shape for this job. Somebody emails support
 * saying "I want out of my pool"; that is a question about ONE person and the
 * pool they are in, and answering it by scrolling a list of every contribution
 * ever made gets worse with every user who joins.
 *
 * So this searches by account ID, name, email or pool name, and answers with
 * the POOL: who is in it, how much each person put in, and a refund button
 * beside each of them. Which is also the view you want when a whole pool needs
 * unwinding one person at a time.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import RefundControls from "@/components/admin/RefundControls";
import { fmtNaira, fmtDateTime, poolProgressPct } from "@/lib/format";

export const metadata = { title: "Refunds · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = `px-4 py-2.5 ${eyebrow} text-slate-400 whitespace-nowrap`;
const td = "px-4 py-3.5 align-top";

type Investor = { id: string; full_name: string | null; email: string; user_code: string | null };

type Row = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  user_id: string;
  pool_id: string;
  user: Investor | null;
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

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { q } = await searchParams;
  const query = (q ?? "").trim();
  // The % and _ wildcards are ours to add, not the searcher's to smuggle in.
  const safe = query.replace(/[%_]/g, "");

  // ── Find the pools worth showing ─────────────────────────────────────────
  //
  // Four ways in, because support gets told whichever the user happened to
  // quote: their account ID, their name, their email, or the pool's name.
  let poolIds: string[] = [];
  let matchedPeople = 0;

  if (safe) {
    // Three separate .ilike() calls rather than one .or(). An .or() takes a
    // filter STRING, so the search term gets interpolated into filter syntax
    // and a comma in it would start a condition of its own. .ilike() passes
    // the term as a value, which cannot be read as syntax at all.
    const [{ data: byName }, { data: byEmail }, { data: byCode }, { data: namedPools }] =
      await Promise.all([
        admin.from("profiles").select("id").ilike("full_name", `%${safe}%`).limit(50),
        admin.from("profiles").select("id").ilike("email", `%${safe}%`).limit(50),
        admin.from("profiles").select("id").ilike("user_code", `%${safe}%`).limit(50),
        admin.from("pools").select("id").ilike("name", `%${safe}%`).limit(50),
      ]);

    const people = [
      ...new Set([...(byName ?? []), ...(byEmail ?? []), ...(byCode ?? [])].map((p) => p.id)),
    ].map((id) => ({ id }));

    matchedPeople = people.length;

    // Every pool those people put money into, plus pools matched by name.
    const theirs = matchedPeople
      ? (
          (
            await admin
              .from("investments")
              .select("pool_id")
              .in(
                "user_id",
                people.map((p) => p.id)
              )
          ).data ?? []
        ).map((i) => i.pool_id)
      : [];

    poolIds = [...new Set([...theirs, ...(namedPools ?? []).map((p) => p.id)])];
  }

  const [{ data: pools }, { data: investments }] = poolIds.length
    ? await Promise.all([
        admin
          .from("pools")
          .select(
            "id, name, status, amount_raised, is_private, created_at, product:pool_products(name, target_amount)"
          )
          .in("id", poolIds)
          .order("created_at", { ascending: false }),
        admin
          .from("investments")
          .select(
            "id, amount, status, created_at, user_id, pool_id, user:profiles(id, full_name, email, user_code)"
          )
          .in("pool_id", poolIds)
          .order("created_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];

  const rows = (investments ?? []) as unknown as Row[];
  const byPool = new Map<string, Row[]>();
  for (const r of rows) byPool.set(r.pool_id, [...(byPool.get(r.pool_id) ?? []), r]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Refunds</h1>
        <p className="text-sm text-slate-500 mt-1">
          Find a pool by account ID, name, email or pool name — then refund whoever needs it.
        </p>
      </div>

      {/* ── SEARCH ── */}
      <form className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={query}
          autoFocus={!query}
          placeholder="RYD4K7M2P, a name, an email, or a pool name"
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
            href="/admin/refunds"
            className="flex shrink-0 items-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── RESULTS ── */}
      {!query ? (
        <Card className="px-5 py-12">
          <p className="text-center text-sm text-slate-500">
            Search for the person who contacted you. You&apos;ll get every pool they are in, who
            else is in it, and a refund button for each contribution.
          </p>
        </Card>
      ) : (pools ?? []).length === 0 ? (
        <Card className="px-5 py-12">
          <p className="text-center text-sm text-slate-500">
            Nothing matches &ldquo;{query}&rdquo;.
            {matchedPeople > 0 && " That account exists but has not joined any pool."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {(pools ?? []).map((pool) => {
            const product = pool.product as unknown as {
              name: string;
              target_amount: number;
            } | null;
            const members = byPool.get(pool.id) ?? [];
            const open = pool.status === "open";
            const pct = poolProgressPct(
              Number(pool.amount_raised),
              Number(product?.target_amount ?? 0)
            );

            return (
              <Card key={pool.id} className="overflow-hidden">
                {/* ── The pool ── */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/pools/${pool.id}`}
                      className="text-sm font-extrabold text-slate-900 transition-colors hover:text-amber-600"
                    >
                      {pool.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {product?.name ?? "—"} · {fmtNaira(pool.amount_raised)} of{" "}
                      {fmtNaira(product?.target_amount ?? 0)} ({pct}%)
                      {pool.is_private && " · private"}
                    </p>
                  </div>
                  <span
                    className={`${eyebrow} shrink-0 rounded-full border px-2.5 py-1 capitalize ${
                      open
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                        : "border-slate-500/20 bg-slate-500/10 text-slate-500"
                    }`}
                  >
                    {open ? "Filling" : pool.status}
                  </span>
                </div>

                {!open && (
                  <p className="border-b border-slate-200/80 bg-amber-50/70 px-5 py-2.5 text-xs leading-relaxed text-amber-800">
                    This pool is {pool.status} — the vehicle is bought and payouts are scheduled,
                    so money cannot be taken back out of it.
                  </p>
                )}

                {/* ── Everyone in it ── */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/60">
                        <th className={th}>Who</th>
                        <th className={`${th} text-right`}>Put in</th>
                        <th className={th}>When</th>
                        <th className={th}>Status</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map((m) => (
                        <tr key={m.id} className="transition-colors hover:bg-slate-50/60">
                          <td className={`${td} min-w-44`}>
                            <Link
                              href={`/admin/users/${m.user_id}`}
                              className="text-sm font-bold text-slate-900 transition-colors hover:text-amber-600"
                            >
                              {m.user?.full_name ?? "—"}
                            </Link>
                            <p className="truncate text-xs text-slate-500">{m.user?.email}</p>
                            <p className="font-mono text-[10px] text-slate-400">
                              {m.user?.user_code ?? ""}
                            </p>
                          </td>

                          <td
                            className={`${td} whitespace-nowrap text-right text-sm font-extrabold tabular-nums ${
                              m.status === "refunded" ? "text-slate-400 line-through" : "text-slate-900"
                            }`}
                          >
                            {fmtNaira(m.amount)}
                          </td>

                          <td className={`${td} whitespace-nowrap text-xs text-slate-500`}>
                            {fmtDateTime(m.created_at)}
                          </td>

                          <td className={`${td} whitespace-nowrap`}>
                            <span
                              className={`${eyebrow} rounded-full border px-2.5 py-1 capitalize ${
                                m.status === "paid"
                                  ? "border-green-500/20 bg-green-500/10 text-green-600"
                                  : m.status === "refunded"
                                    ? "border-slate-500/20 bg-slate-500/10 text-slate-500"
                                    : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {m.status.replace(/_/g, " ")}
                            </span>
                          </td>

                          <td className={`${td} min-w-52`}>
                            {m.status === "paid" && open ? (
                              <RefundControls
                                investmentId={m.id}
                                amount={Number(m.amount)}
                                investorName={m.user?.full_name || "this user"}
                              />
                            ) : m.status === "refunded" ? (
                              <span className="text-[11px] text-slate-400">Already refunded</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}

                      {members.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                            Nobody has put money into this pool yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
