/**
 * ADMIN → EMAIL — write to users, and see what has already gone out.
 *
 * The history below the composer is not decoration: a send to everyone runs
 * in batches, so "is it finished?" is a real question with a real answer, and
 * the only honest place to answer it is from the recipient rows themselves.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supportFrom, noReplyFrom } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { BroadcastComposer, type Person } from "@/components/admin/BroadcastComposer";
import { SendRestButton } from "@/components/admin/SendRestButton";

export const metadata = { title: "Email · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

type Counts = { total: number; sent: number; failed: number; pending: number };

export default async function AdminEmailPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: profiles }, { data: broadcasts }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, marketing_opt_out")
      .order("full_name", { ascending: true })
      .limit(2000),
    admin
      .from("broadcasts")
      .select("id, subject, audience, from_role, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const people: Person[] = (profiles ?? [])
    .filter((p) => Boolean(p.email))
    .map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string) ?? "",
      email: p.email as string,
      opted_out: Boolean(p.marketing_opt_out),
    }));

  // One progress call per broadcast, counted in the database rather than by
  // pulling every recipient row into the page.
  const progress = new Map<string, Counts>();
  await Promise.all(
    (broadcasts ?? []).map(async (b) => {
      const { data } = await admin.rpc("broadcast_progress", { p_broadcast_id: b.id });
      progress.set(b.id as string, (data ?? { total: 0, sent: 0, failed: 0, pending: 0 }) as Counts);
    })
  );

  return (
    <div className="flex max-w-6xl flex-col gap-7">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Email users</h1>
        <p className="text-sm text-slate-500">
          One email per person, in the Rydvest template, addressed by their own first name.
        </p>
      </div>

      <BroadcastComposer
        people={people}
        supportAddress={supportFrom()}
        noReplyAddress={noReplyFrom()}
      />

      {/* ── WHAT HAS BEEN SENT ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-extrabold text-slate-900">Sent</h2>
          <p className="mt-0.5 text-xs text-slate-500">The last 20, newest first.</p>
        </div>

        {(broadcasts ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nothing sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>Sent</th>
                  <th className={`px-5 py-2.5 ${eyebrow} text-slate-400`}>Subject</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>To</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>
                    Progress
                  </th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`} />
                </tr>
              </thead>
              <tbody>
                {(broadcasts ?? []).map((b) => {
                  const c = progress.get(b.id as string) ?? {
                    total: 0,
                    sent: 0,
                    failed: 0,
                    pending: 0,
                  };
                  return (
                    <tr key={b.id as string} className="border-b border-slate-100 last:border-0 odd:bg-slate-50/60">
                      <td className="px-5 py-3.5 align-middle text-xs whitespace-nowrap text-slate-500">
                        {fmtDateTime(b.created_at as string)}
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <span className="text-sm font-semibold text-slate-900">
                          {b.subject as string}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          from {b.from_role === "noreply" ? "no-reply" : "support"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-sm whitespace-nowrap text-slate-600">
                        {b.audience === "all" ? "Everyone" : "Chosen people"}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-sm whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-slate-900">
                          {c.sent}/{c.total}
                        </span>
                        {c.failed > 0 && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            {c.failed} failed
                          </span>
                        )}
                        {c.pending > 0 && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            {c.pending} queued
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                        {c.pending > 0 && <SendRestButton broadcastId={b.id as string} left={c.pending} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-slate-200 px-5 py-3.5 text-xs leading-relaxed text-slate-500">
          Large sends go out in batches of 40 so a request never runs out of time halfway. Each
          person&apos;s copy is recorded separately, so pressing “Send the rest” only ever reaches
          people who have not had it.
        </p>
      </div>
    </div>
  );
}
