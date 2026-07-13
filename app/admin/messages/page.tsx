/**
 * ADMIN → MESSAGES — submissions from the public "Talk to us" contact form.
 *
 * Workers can reply two ways (both end up with the customer):
 *   1. In-dashboard reply box — sends FROM the support inbox via Resend and
 *      records the reply here (audit trail: who replied, what, when).
 *   2. "Reply by email" — opens their own mail client on the support mailbox
 *      (Zoho); they then mark the message handled manually.
 * Customer follow-ups always land in the support mailbox either way.
 */
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markMessageHandled } from "@/app/actions/admin";
import ReplyForm from "@/components/admin/ReplyForm";
import { fmtDate } from "@/lib/format";

export default async function AdminMessagesPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: messages }, { data: replies }] = await Promise.all([
    admin
      .from("contact_messages")
      .select("id, name, email, phone, message, handled, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contact_replies")
      .select("id, message_id, body, created_at, admin:profiles(full_name)")
      .order("created_at", { ascending: true }),
  ]);

  // Group replies under their message.
  const repliesByMessage = new Map<string, NonNullable<typeof replies>>();
  for (const r of replies ?? []) {
    const list = repliesByMessage.get(r.message_id) ?? [];
    list.push(r);
    repliesByMessage.set(r.message_id, list);
  }

  const open = (messages ?? []).filter((m) => !m.handled);
  const done = (messages ?? []).filter((m) => m.handled);

  const ReplyHistory = ({ messageId }: { messageId: string }) => {
    const list = repliesByMessage.get(messageId) ?? [];
    if (list.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 mt-3">
        {list.map((r) => (
          <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">
              Replied by {(r.admin as unknown as { full_name: string })?.full_name ?? "admin"} · {fmtDate(r.created_at)}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{r.body}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Contact messages</h1>
        <p className="text-sm text-slate-500">
          Reply right here (sent from the support inbox) or from Zoho — then the message is marked handled.
        </p>
      </div>

      {/* Needs a reply */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-slate-900">Needs a reply ({open.length})</h2>
        {open.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">Inbox zero — no unhandled messages. 🎉</p>
          </div>
        )}
        {open.map((m) => (
          <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-400">
                  <a href={`mailto:${m.email}`} className="text-amber-500 hover:text-amber-600 font-semibold">{m.email}</a>
                  {m.phone ? ` · ${m.phone}` : ""} · {fmtDate(m.created_at)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Rydvest")}`}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Reply from Zoho
                </a>
                <form action={markMessageHandled}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <button type="submit" className="text-xs font-bold px-4 py-2 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors">
                    Mark handled
                  </button>
                </form>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              {m.message}
            </p>

            <ReplyHistory messageId={m.id} />

            {/* In-dashboard reply — sends from support@ and closes the message. */}
            <div className="mt-3">
              <ReplyForm messageId={m.id} toEmail={m.email} />
            </div>
          </div>
        ))}
      </div>

      {/* Handled */}
      {done.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold text-slate-900">Handled ({done.length})</h2>
          {done.map((m) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{m.name}</span>
                <span className="text-slate-400"> · {m.email} · {fmtDate(m.created_at)}</span>
              </p>
              <p className="text-xs text-slate-500 whitespace-pre-wrap mt-1">{m.message}</p>
              <ReplyHistory messageId={m.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
