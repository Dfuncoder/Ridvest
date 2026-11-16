"use client";

/**
 * Writing an article.
 *
 * Two panes: the fields on the left, what a reader will see on the right.
 * The preview renders the same two rules the public page does — a blank line
 * starts a paragraph, "## " is a subheading — so "how will this look" is
 * answered before publishing rather than after.
 *
 * Save as draft and Publish are the same form posted with a different status,
 * not two code paths. The only difference between a draft and a published
 * piece is one column, and the screen should say so.
 */
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { saveArticle, deleteArticle } from "@/app/actions/articles";
import type { FormState } from "@/app/actions/auth";
import type { Article } from "@/lib/articles";

const input =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5";

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

/** Mirrors slugify() on the server — offered, never imposed. */
function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
    .replace(/^-|-$/g, "");
}

export function ArticleEditor({ article }: { article?: Article }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveArticle, undefined);
  const [removeState, removeAction, removing] = useActionState<FormState, FormData>(
    deleteArticle,
    undefined
  );

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [category, setCategory] = useState(article?.category ?? "News");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The slug follows the title until somebody edits it. After that it is
  // theirs: an address that rewrites itself while you are typing a headline
  // is how a published link quietly changes.
  const effectiveSlug = slugTouched ? slug : suggestSlug(title);

  const blocks = useMemo(
    () => body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean),
    [body]
  );

  const err = (f: string) => state?.errors?.[f];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <form action={action} className="flex min-w-0 flex-col gap-5">
        {article && <input type="hidden" name="id" value={article.id} />}
        <input type="hidden" name="slug" value={effectiveSlug} />

        {state?.message && (
          <p
            className={`rounded-xl border px-3.5 py-3 text-xs leading-relaxed font-medium ${
              state.success
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {state.message}
          </p>
        )}

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <label htmlFor="title" className={label}>
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={160}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Rydvest expands keke operations to a second state"
              className={input}
            />
            <Err msg={err("title")} />
          </div>

          <div>
            <label htmlFor="slug-visible" className={label}>
              Web address
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs whitespace-nowrap text-slate-400">/articles/</span>
              <input
                id="slug-visible"
                type="text"
                maxLength={90}
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className={input}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {article
                ? "Changing this breaks every existing link to the article, including ones already shared."
                : "Taken from the title. Edit it now if you want something shorter — it is permanent once shared."}
            </p>
            <Err msg={err("slug")} />
          </div>

          <div>
            <label htmlFor="summary" className={label}>
              Summary
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={2}
              maxLength={320}
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two sentences. This is what shows on the articles page and in Google."
              className={`${input} resize-y leading-relaxed`}
            />
            <Err msg={err("summary")} />
          </div>

          <div>
            <label htmlFor="category" className={label}>
              Category
            </label>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as "News" | "Company")}
              className={input}
            >
              <option value="News">News — the industry</option>
              <option value="Company">Company — about Rydvest</option>
            </select>
            <Err msg={err("category")} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <label htmlFor="body" className={label}>
            The article
          </label>
          <textarea
            id="body"
            name="body"
            rows={18}
            maxLength={40000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              "Write it plainly.\n\nLeave a blank line between paragraphs.\n\n## A subheading starts with two hashes"
            }
            className={`${input} resize-y leading-relaxed`}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Plain text. A blank line starts a paragraph, a line starting “## ” is a subheading.
            {" "}
            {body.length.toLocaleString("en-NG")} of 40,000 characters.
          </p>
          <Err msg={err("body")} />
        </div>

        {/* Draft and publish are the same submit with a different status. */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="status"
            value="published"
            disabled={pending}
            className="rounded-xl bg-[#0d2137] px-5 py-2.5 text-sm font-extrabold text-white transition-all duration-150 hover:bg-[#143352] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving..." : article?.status === "published" ? "Save changes" : "Publish"}
          </button>
          <button
            type="submit"
            name="status"
            value="draft"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {article?.status === "published" ? "Unpublish and keep as draft" : "Save as draft"}
          </button>
          <Link
            href="/admin/articles"
            className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
          >
            Back
          </Link>
          <Err msg={err("status")} />
        </div>

        {article?.status === "published" && (
          <p className="text-xs text-slate-500">
            Live at{" "}
            <Link
              href={`/articles/${article.slug}`}
              className="font-semibold text-slate-900 hover:underline"
            >
              /articles/{article.slug}
            </Link>
          </p>
        )}
      </form>

      {/* ── PREVIEW ── */}
      <div className="min-w-0">
        <p className={`${label} mb-2`}>How it will read</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{category}</span>
            <span className="text-slate-400">Today</span>
          </p>

          <h2 className="mb-4 text-2xl leading-tight font-black tracking-tight text-slate-900">
            {title || "Your title goes here"}
          </h2>

          {summary && (
            <p className="mb-6 border-l-2 border-amber-400 pl-4 text-sm leading-relaxed font-medium text-slate-600">
              {summary}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {blocks.length === 0 ? (
              <p className="text-sm text-slate-400">The article will appear here as you write.</p>
            ) : (
              blocks.map((block, i) =>
                block.startsWith("## ") ? (
                  <h3 key={i} className="mt-2 text-base font-extrabold text-slate-900">
                    {block.slice(3)}
                  </h3>
                ) : (
                  <p
                    key={i}
                    className="text-sm leading-[1.8] whitespace-pre-line text-slate-700"
                  >
                    {block}
                  </p>
                )
              )
            )}
          </div>
        </div>

        {/* Deleting lives here, on the page where the article is in front of
            you — not on a list, where it is a button pressed on the wrong row. */}
        {article && (
          <form action={removeAction} className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-5">
            <input type="hidden" name="id" value={article.id} />
            <p className="text-xs leading-relaxed text-slate-600">
              Deleting removes the article and its web address for good. If you only want it off
              the site, use “Unpublish” instead — the text stays here.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
              />
              <span className="text-xs font-semibold text-slate-700">
                I want this article deleted permanently.
              </span>
            </label>
            <button
              type="submit"
              disabled={removing || !confirmDelete}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {removing ? "Deleting..." : "Delete article"}
            </button>
            {removeState?.message && (
              <p className="mt-2 text-xs text-slate-600">{removeState.message}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
