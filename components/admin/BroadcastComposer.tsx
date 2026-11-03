"use client";

/**
 * Writing an email to users.
 *
 * Three decisions, in the order somebody actually makes them: who it goes to,
 * who it comes from, and what it says. The preview is beside the form rather
 * than behind a button, because the whole promise of this screen is that you
 * cannot accidentally send something that looks wrong.
 *
 * The preview renders the same paragraphs the server will, but it is NOT the
 * email: the server builds that from lib/notices.ts, from the text posted
 * here. This is a faithful sketch of it, not a second implementation of the
 * template — the frame, colours and footer are approximated once, here.
 */
import { useActionState, useMemo, useState } from "react";
import { createBroadcast } from "@/app/actions/broadcast";
import type { FormState } from "@/app/actions/auth";

export type Person = { id: string; full_name: string; email: string; opted_out: boolean };

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

export function BroadcastComposer({
  people,
  supportAddress,
  noReplyAddress,
}: {
  people: Person[];
  supportAddress: string;
  noReplyAddress: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBroadcast, undefined);

  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const reachable = people.filter((p) => !p.opted_out);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [people, search]);

  const count = audience === "all" ? reachable.length : picked.size;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const err = (f: string) => state?.errors?.[f];
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form action={action} className="flex min-w-0 flex-col gap-6">
        {state?.message && (
          <p
            className={`rounded-xl border px-3.5 py-3 text-xs font-medium leading-relaxed ${
              state.success
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {state.message}
          </p>
        )}

        {/* ── WHO ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className={label}>Who gets it</p>
          <input type="hidden" name="audience" value={audience} />

          <div className="grid gap-2.5 sm:grid-cols-2">
            {([
              {
                value: "all" as const,
                title: "Everyone",
                blurb: `${reachable.length} ${reachable.length === 1 ? "person" : "people"}${
                  people.length - reachable.length > 0
                    ? ` · ${people.length - reachable.length} opted out`
                    : ""
                }`,
              },
              {
                value: "selected" as const,
                title: "Chosen people",
                blurb: picked.size > 0 ? `${picked.size} selected` : "Pick them below",
              },
            ]).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setAudience(o.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  audience === o.value
                    ? "border-amber-400 bg-amber-50/60"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-bold text-slate-900">{o.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{o.blurb}</span>
              </button>
            ))}
          </div>

          {audience === "selected" && (
            <div className="mt-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className={input}
              />
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                {matches.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-slate-500">Nobody matches that.</p>
                ) : (
                  matches.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 shrink-0 accent-amber-500"
                      />
                      {picked.has(p.id) && <input type="hidden" name="recipients" value={p.id} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {p.full_name || "—"}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{p.email}</span>
                      </span>
                      {p.opted_out && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-slate-500">
                          opted out
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Someone who opted out of updates still receives a message you address to them
                directly — this list is correspondence, not marketing.
              </p>
            </div>
          )}
          <Err msg={err("recipients")} />
        </div>

        {/* ── FROM ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label htmlFor="fromRole" className={label}>
            Sent from
          </label>
          <select id="fromRole" name="fromRole" defaultValue="support" className={input}>
            <option value="support">{supportAddress} — replies come back to support</option>
            <option value="noreply">{noReplyAddress} — for announcements</option>
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Either way the Reply-To is the support inbox, so an answer always reaches a person.
          </p>
          <Err msg={err("fromRole")} />
        </div>

        {/* ── WHAT ── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="subject" className={label}>
              Subject line
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              maxLength={150}
              required
              placeholder="Your October earnings are on the way"
              className={input}
            />
            <Err msg={err("subject")} />
          </div>

          <div>
            <label htmlFor="heading" className={label}>
              Heading inside the email
            </label>
            <input
              id="heading"
              name="heading"
              type="text"
              maxLength={120}
              required
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="A quick update on your pool"
              className={input}
            />
            <Err msg={err("heading")} />
          </div>

          <div>
            <label htmlFor="body" className={label}>
              Message
            </label>
            <textarea
              id="body"
              name="body"
              rows={9}
              maxLength={8000}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Write it as you would say it.\n\nLeave a blank line between paragraphs."}
              className={`${input} resize-y leading-relaxed`}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Plain text. A blank line starts a new paragraph. Each person is greeted by their own
              first name automatically.
            </p>
            <Err msg={err("body")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ctaLabel" className={label}>
                Button text (optional)
              </label>
              <input
                id="ctaLabel"
                name="ctaLabel"
                type="text"
                maxLength={40}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="See my pools"
                className={input}
              />
              <Err msg={err("ctaLabel")} />
            </div>
            <div>
              <label htmlFor="ctaUrl" className={label}>
                Button link
              </label>
              <input
                id="ctaUrl"
                name="ctaUrl"
                type="url"
                maxLength={300}
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://rydvest.com/dashboard/pools"
                className={input}
              />
              <Err msg={err("ctaUrl")} />
            </div>
          </div>
        </div>

        {/* ── SEND ── */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <label htmlFor="confirm" className="flex cursor-pointer items-start gap-3">
            <input
              id="confirm"
              name="confirm"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
            />
            <span className="text-xs leading-relaxed text-slate-700">
              I have read it back, and I want this sent to{" "}
              <strong className="font-bold">
                {count} {count === 1 ? "person" : "people"}
              </strong>
              . Sent email cannot be recalled.
            </span>
          </label>
          <Err msg={err("confirm")} />

          <button
            type="submit"
            disabled={pending || count === 0}
            className="mt-4 w-full rounded-xl bg-[#0d2137] px-5 py-3 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#143352] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending..." : `Send to ${count} ${count === 1 ? "person" : "people"}`}
          </button>
        </div>
      </form>

      {/* ── PREVIEW ── */}
      <div className="min-w-0">
        <p className={`${label} mb-2`}>Preview</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="bg-[#0d2137] px-5 py-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-400">
                Rydvest
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="mb-3 text-base font-extrabold text-slate-900">
                {heading || "Your heading goes here"}
              </p>
              <p className="mb-3 text-sm leading-relaxed text-slate-700">Hi Jude,</p>
              {paragraphs.length === 0 ? (
                <p className="text-sm leading-relaxed text-slate-400">
                  Your message will appear here as you type.
                </p>
              ) : (
                paragraphs.map((p, i) => (
                  <p key={i} className="mb-3 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                    {p}
                  </p>
                ))
              )}
              {ctaLabel && ctaUrl && (
                <p className="mt-4 rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-extrabold text-[#0d2137]">
                  {ctaLabel}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Questions? Reply to this email or contact {supportAddress}.
              </p>
              {audience === "all" && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Don&apos;t want updates like this? Unsubscribe.
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          A sketch of the real thing — the email itself is built on the server from the same
          template as your receipts.
        </p>
      </div>
    </div>
  );
}
