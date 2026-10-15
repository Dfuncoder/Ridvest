/**
 * ADMIN → ONE MESSAGE — read it, see what has already been said, and answer.
 *
 * This is where the "Open and reply" button in the notification email lands.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markMessageHandled } from "@/app/actions/admin";
import ReplyForm from "@/components/admin/ReplyForm";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Message · Rydvest admin" };


function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AdminMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: message } = await admin
    .from("contact_messages")
    .select("id, name, email, phone, message, handled, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!message) notFound();

  const { data: replies } = await admin
    .from("contact_replies")
    .select("id, body, created_at, admin:profiles(full_name)")
    .eq("message_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <Link
        href="/admin/messages"
        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
      >
        ← All messages
      </Link>

      {/* ── THE MESSAGE ── */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{message.name}</h1>
            <a
              href={`mailto:${message.email}`}
              className="text-sm text-amber-600 hover:text-amber-500 transition-colors"
            >
              {message.email}
            </a>
            {message.phone && (
              <p className="text-sm text-slate-500">
                <a href={`tel:${message.phone}`} className="hover:text-slate-700">
                  {message.phone}
                </a>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">{fmtDateTime(message.created_at)}</p>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
              message.handled
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            }`}
          >
            {message.handled ? "Handled" : "Open"}
          </span>
        </div>

        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-3.5">
          {message.message}
        </p>
      </Card>

      {/* ── WHAT HAS BEEN SAID ── */}
      {(replies ?? []).length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">
            Replies ({(replies ?? []).length})
          </h2>
          <div className="flex flex-col gap-3">
            {(replies ?? []).map((r) => {
              const author = r.admin as unknown as { full_name: string | null } | null;
              return (
                <div key={r.id} className="border-l-2 border-amber-300 pl-4 py-1">
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {r.body}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {author?.full_name ?? "Admin"} · {fmtDateTime(r.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── ANSWER ── */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Reply</h2>
        <p className="text-xs text-slate-500 mb-4">
          Sent from the support inbox, so their answer comes back to the same place.
        </p>
        <ReplyForm messageId={message.id} toEmail={message.email} />
      </Card>

      {/* ── CLOSE IT ── */}
      {!message.handled && (
        <form action={markMessageHandled}>
          <input type="hidden" name="messageId" value={message.id} />
          <button
            type="submit"
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition-colors"
          >
            Mark as handled
          </button>
        </form>
      )}
    </div>
  );
}
