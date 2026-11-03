"use client";

/**
 * Sends the next batch of a broadcast that still has people queued.
 *
 * Deliberately a button somebody presses rather than a background job: a
 * half-sent broadcast is something an admin should be looking at, and a queue
 * that drains invisibly is a queue nobody checks until a customer asks why
 * they never heard anything.
 */
import { useActionState } from "react";
import { sendBroadcastBatch } from "@/app/actions/broadcast";
import type { FormState } from "@/app/actions/auth";

export function SendRestButton({ broadcastId, left }: { broadcastId: string; left: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    sendBroadcastBatch,
    undefined
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="broadcastId" value={broadcastId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Sending..." : `Send the rest (${left})`}
      </button>
      {state?.message && (
        <span className="text-[10px] leading-relaxed text-slate-500">{state.message}</span>
      )}
    </form>
  );
}
