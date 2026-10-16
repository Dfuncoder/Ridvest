"use client";

/**
 * The NIMC lookup result for one submission.
 *
 * Shows the name on the national record against the name on the profile,
 * because that comparison is the whole point of running the check — a number
 * alone proves nothing, and a number that belongs to someone else is the thing
 * worth catching.
 *
 * Deliberately NOT a verdict. A matched NIN says the number is real and whose
 * it is; it says nothing about whether the face in the selfie is that person.
 * The wording keeps that distinction so nobody approves on the badge alone.
 */
import { useActionState } from "react";
import { recheckKycNin } from "@/app/actions/admin";
import { fmtDateTime } from "@/lib/format";
import { lookupIsStale } from "@/lib/kyc";
import type { FormState } from "@/app/actions/auth";

type Status = "none" | "checking" | "matched" | "mismatch" | "not_found" | "failed";

const TONE: Record<Status, { box: string; pill: string; label: string }> = {
  none: {
    box: "border-slate-200 bg-slate-50",
    pill: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    label: "Not checked",
  },
  checking: {
    box: "border-blue-200 bg-blue-50",
    pill: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    label: "Checking",
  },
  matched: {
    box: "border-green-200 bg-green-50",
    pill: "bg-green-500/10 text-green-700 border-green-500/20",
    label: "Name matches",
  },
  mismatch: {
    box: "border-red-200 bg-red-50",
    pill: "bg-red-500/10 text-red-600 border-red-500/20",
    label: "Name does not match",
  },
  not_found: {
    box: "border-red-200 bg-red-50",
    pill: "bg-red-500/10 text-red-600 border-red-500/20",
    label: "No such NIN",
  },
  failed: {
    box: "border-amber-200 bg-amber-50",
    pill: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    label: "Check failed",
  },
};

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

export default function NinCheck({
  status,
  nimcName,
  nimcDob,
  profileName,
  error,
  checkedAt,
  submissionId,
}: {
  status: string;
  nimcName: string;
  nimcDob: string | null;
  profileName: string;
  error: string | null;
  checkedAt: string | null;
  submissionId: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(recheckKycNin, undefined);

  const key = (status in TONE ? status : "none") as Status;
  const tone = TONE[key];

  // A check that has been "running" for longer than a lookup could possibly
  // take did not survive the request that started it. Offering the re-run is
  // the only way back — without this a stuck row is unrecoverable from the UI.
  const stuck = key === "checking" && lookupIsStale(checkedAt);
  const rerunnable = key === "failed" || key === "none" || stuck;

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${tone.box}`}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className={`${eyebrow} text-slate-500`}>NIN check</p>
        <span className={`${eyebrow} rounded-full border px-2.5 py-1 ${tone.pill}`}>
          {tone.label}
        </span>
      </div>

      {key === "checking" && !stuck && (
        <p className="text-xs leading-relaxed text-slate-600">
          Running now — it takes a few seconds. Reload to see the result.
        </p>
      )}

      {stuck && (
        <p className="text-xs leading-relaxed text-amber-800">
          This check started a while ago and never finished, so it is not coming back. Nothing is
          wrong with the submission — run it again.
        </p>
      )}

      {(key === "matched" || key === "mismatch") && (
        <dl className="grid gap-2.5 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className={`${eyebrow} text-slate-400`}>Name on the NIN</dt>
            <dd className="truncate text-sm font-extrabold text-slate-900">{nimcName || "—"}</dd>
            {nimcDob && <dd className="text-[11px] text-slate-500">born {nimcDob}</dd>}
          </div>
          <div className="min-w-0">
            <dt className={`${eyebrow} text-slate-400`}>Name on the profile</dt>
            <dd className="truncate text-sm font-extrabold text-slate-900">
              {profileName || "—"}
            </dd>
          </div>
        </dl>
      )}

      {key === "mismatch" && (
        <p className="mt-2.5 text-xs leading-relaxed text-red-700">
          This NIN belongs to a different name. Unless they can explain it, this is somebody
          else&apos;s number.
        </p>
      )}

      {key === "matched" && (
        <p className="mt-2.5 text-xs leading-relaxed text-green-800">
          The number is real and registered to this name. Still check the photo is the same
          person before approving.
        </p>
      )}

      {key === "not_found" && (
        <p className="text-xs leading-relaxed text-red-700">
          NIMC has no record of this number.
        </p>
      )}

      {key === "failed" && (
        <p className="text-xs leading-relaxed text-amber-800">
          {error ?? "The check did not complete."} Nothing is wrong with this submission — run it
          again once the cause is fixed.
        </p>
      )}

      {checkedAt && (key !== "checking" || stuck) && (
        <p className="mt-2 text-[10px] text-slate-400">
          {stuck ? "Started" : "Checked"} {fmtDateTime(checkedAt)}
        </p>
      )}

      {rerunnable && (
        <form action={action} className="mt-3">
          <input type="hidden" name="submissionId" value={submissionId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Checking..." : "Run the check"}
          </button>
          {state?.message && (
            <p
              className={`mt-2 text-[11px] ${
                state.success ? "text-green-700" : "text-red-600"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
