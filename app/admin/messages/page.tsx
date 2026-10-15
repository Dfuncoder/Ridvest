/**
 * ADMIN → MESSAGES — everything sent through the contact form.
 *
 * A list only: opening one is how you read and answer it, so a long thread
 * does not push the next message off the screen.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Messages · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";
const th = "px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] whitespace-nowrap";
const td = "px-4 py-3.5 align-top";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AdminMessagesPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: messages, error }, { data: replies }] = await Promise.all([
    admin
      .from("contact_messages")
      .select("id, name, email, phone, message, handled, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("contact_replies").select("message_id, created_at"),
  ]);

  if (error) console.error("[admin] messages query failed", error);

  const replyCount = new Map<string, number>();
  const lastReply = new Map<string, string>();
  for (const r of replies ?? []) {
    replyCount.set(r.message_id, (replyCount.get(r.message_id) ?? 0) + 1);
    const current = lastReply.get(r.message_id);
    if (!current || r.created_at > current) lastReply.set(r.message_id, r.created_at);
  }

  const rows = messages ?? [];
  const open = rows.filter((m) => !m.handled);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Messages</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everything sent through the contact form. Open one to read it and reply.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Total", value: String(rows.length), tone: "text-slate-900" },
          {
            label: "Needs attention",
            value: String(open.length),
            tone: open.length ? "text-amber-600" : "text-slate-300",
          },
          {
            label: "Replied to",
            value: String(rows.filter((m) => (replyCount.get(m.id) ?? 0) > 0).length),
            tone: "text-green-600",
          },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-500 text-center">No messages yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className={th}>From</th>
                  <th className={th}>Message</th>
                  <th className={th}>Received</th>
                  <th className={th}>Replies</th>
                  <th className={th}>Status</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const count = replyCount.get(m.id) ?? 0;
                  return (
                    <tr
                      key={m.id}
                      className={m.handled ? "hover:bg-slate-50/60 transition-colors" : "bg-amber-50/40"}
                    >
                      <td className={`${td} min-w-44`}>
                        <Link
                          href={`/admin/messages/${m.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-amber-600 transition-colors"
                        >
                          {m.name}
                        </Link>
                        <p className="text-xs text-slate-500 truncate">{m.email}</p>
                        {m.phone && <p className="text-xs text-slate-400">{m.phone}</p>}
                      </td>

                      <td className={`${td} min-w-64 max-w-md`}>
                        <p className="text-xs text-slate-600 line-clamp-2">{m.message}</p>
                      </td>

                      <td className={`${td} text-xs text-slate-500 whitespace-nowrap`}>
                        {fmtDateTime(m.created_at)}
                      </td>

                      <td className={`${td} text-xs text-slate-600 whitespace-nowrap`}>
                        {count === 0 ? (
                          <span className="text-slate-300">None</span>
                        ) : (
                          <>
                            {count}
                            <span className="block text-[10px] text-slate-400">
                              last {fmtDateTime(lastReply.get(m.id) ?? m.created_at)}
                            </span>
                          </>
                        )}
                      </td>

                      <td className={`${td} whitespace-nowrap`}>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            m.handled
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {m.handled ? "Handled" : "Open"}
                        </span>
                      </td>

                      <td className={`${td} whitespace-nowrap`}>
                        <Link
                          href={`/admin/messages/${m.id}`}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-400">Showing the 200 most recent messages.</p>
    </div>
  );
}
