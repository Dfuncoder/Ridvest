"use client";

/**
 * In-dashboard reply box for a contact message. Sends the email from the
 * support inbox via the replyToMessage server action and records it in the
 * database for the audit trail.
 */
import { useActionState } from "react";
import { replyToMessage } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

export default function ReplyForm({ messageId, toEmail }: { messageId: string; toEmail: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(replyToMessage, undefined);

  if (state?.success) {
    return (
      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        ✓ {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state?.message && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {state.message}
        </p>
      )}
      <input type="hidden" name="messageId" value={messageId} />
      <textarea
        name="body"
        rows={3}
        required
        maxLength={5000}
        placeholder={`Write your reply — it will be emailed to ${toEmail} from the support inbox.`}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors resize-y"
      />
      {state?.errors?.body && <p className="text-xs text-red-600">{state.errors.body}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-bold px-5 py-2.5 rounded-xl bg-amber-400 text-[#0d2137] hover:bg-amber-300 transition-colors disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
