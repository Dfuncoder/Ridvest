/**
 * UNSUBSCRIBE — one click, no login.
 *
 * Reached from the footer of a broadcast. The token in the URL is an HMAC of
 * the user id (lib/unsubscribe.ts), so it only works for the person it was
 * mailed to and cannot be walked to opt everybody out.
 *
 * It acts on load rather than asking for a confirmation click. A second step
 * is a step people do not take, and "I clicked unsubscribe and still get your
 * email" is a spam report. The undo is right there instead, for anyone who
 * arrived by accident.
 */
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email preferences — Rydvest",
  robots: { index: false, follow: false },
};

type Outcome = "done" | "resubscribed" | "invalid";

async function apply(token: string | undefined, undo: boolean): Promise<Outcome> {
  const userId = readUnsubscribeToken(token);
  if (!userId) return "invalid";

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ marketing_opt_out: !undo })
    .eq("id", userId);

  if (error) {
    console.error("[unsubscribe] could not update preference", error.message);
    return "invalid";
  }

  return undo ? "resubscribed" : "done";
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; undo?: string }>;
}) {
  const { t, undo } = await searchParams;
  const outcome = await apply(t, undo === "1");

  const copy: Record<Outcome, { title: string; body: string }> = {
    done: {
      title: "You're unsubscribed",
      body: "You won't get general updates from Rydvest any more. Receipts, login codes and security notices still come through — those are part of your account, not marketing.",
    },
    resubscribed: {
      title: "You're back on the list",
      body: "You'll get Rydvest updates again. You can unsubscribe any time from the bottom of one of those emails.",
    },
    invalid: {
      title: "That link didn't work",
      body: "It may have been broken by your email app, or it was never a Rydvest link. Email support@rydvest.com and we'll sort your preferences out by hand.",
    },
  };

  const { title, body } = copy[outcome];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d2137] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f2e52] p-7 text-center">
        <p className="mb-6 text-lg font-extrabold tracking-tight text-white">
          Ryd<span className="text-amber-400">vest</span>
        </p>

        <h1 className="mb-2 text-xl font-extrabold text-white">{title}</h1>
        <p className="text-sm leading-relaxed text-slate-400">{body}</p>

        {outcome === "done" && t && (
          <Link
            href={`/unsubscribe?t=${encodeURIComponent(t)}&undo=1`}
            className="mt-6 inline-block text-sm font-semibold text-amber-400 transition-colors hover:text-amber-300"
          >
            That was a mistake — put me back
          </Link>
        )}

        <Link
          href="/"
          className="mt-6 block text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          Back to rydvest.com
        </Link>
      </div>
    </main>
  );
}
