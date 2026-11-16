/**
 * One article.
 *
 * The body is rendered from plain text — paragraphs, and "## " for a
 * subheading. No HTML is interpreted, which is the point: a news page that
 * renders raw markup is a place for somebody else's script to end up.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import { CTABanner, Footer } from "@/components/Footer";
import { findPublished, articleDate } from "@/lib/articles";
import { pageMeta } from "@/lib/seo";

// Rendered per request: an article published a moment ago has to be there a
// moment later, and the admin pressing Publish is the person most likely to
// check.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await findPublished(slug);
  if (!article) return pageMeta({ title: "Article — Rydvest", description: "Rydvest articles." });

  return pageMeta({ title: `${article.title} — Rydvest`, description: article.summary });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await findPublished(slug);
  // A draft answers 404 exactly as a non-existent one does. Anything softer
  // tells somebody guessing slugs that they guessed right.
  if (!article) notFound();

  const isLoggedIn = Boolean(await getSessionUser());

  const blocks: string[] = article.body
    .split(/\n\s*\n/)
    .map((b: string) => b.trim())
    .filter(Boolean);

  return (
    <main>
      <SiteNavbar />

      <article className="bg-white px-5 pt-14 pb-16 sm:px-6 lg:pt-20">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/articles"
            className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
          >
            ← All articles
          </Link>

          <p className="mt-7 mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
              {article.category}
            </span>
            <span className="text-slate-400">{articleDate(article.published_at)}</span>
          </p>

          <h1 className="mb-5 text-3xl leading-[1.12] font-black tracking-tight text-slate-900 sm:text-4xl">
            {article.title}
          </h1>

          <p className="mb-9 border-l-2 border-amber-400 pl-4 text-lg leading-relaxed font-medium text-slate-600">
            {article.summary}
          </p>

          <div className="flex flex-col gap-5">
            {blocks.map((block, i) =>
              block.startsWith("## ") ? (
                <h2
                  key={i}
                  className="mt-3 text-xl font-extrabold tracking-tight text-slate-900"
                >
                  {block.slice(3)}
                </h2>
              ) : (
                <p key={i} className="text-base leading-[1.8] whitespace-pre-line text-slate-700">
                  {block}
                </p>
              )
            )}
          </div>
        </div>
      </article>

      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
