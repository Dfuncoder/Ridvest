/**
 * ARTICLES — the index. News around transportation, and about Rydvest.
 */
import Link from "next/link";
import SiteNavbar from "@/components/SiteNavbar";
import { getSessionUser } from "@/lib/auth";
import { CTABanner, Footer } from "@/components/Footer";
import { listPublished, articleDate } from "@/lib/articles";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  title: "Articles — Rydvest",
  description:
    "News around transportation in Nigeria, and updates from Rydvest on vehicle ownership, pools and payouts.",
});

export default async function ArticlesPage() {
  const isLoggedIn = Boolean(await getSessionUser());
  const articles = await listPublished();

  return (
    <main>
      <SiteNavbar />

      <section className="bg-white px-5 pt-14 pb-16 sm:px-6 lg:pt-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-blue-600 uppercase">
            Articles
          </p>
          <h1 className="mb-4 text-4xl leading-[1.05] font-black tracking-tight text-slate-900 sm:text-5xl">
            Transportation, written down.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
            News from the industry we work in, and what we are building at Rydvest.
          </p>

          {articles.length === 0 ? (
            <p className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              Nothing published yet. Check back shortly.
            </p>
          ) : (
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {articles.map((a) => (
                <Link
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <span className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                      {a.category}
                    </span>
                    <span className="text-slate-400">{articleDate(a.published_at)}</span>
                  </span>

                  <h2 className="mb-2 text-lg leading-snug font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700">
                    {a.title}
                  </h2>
                  <p className="min-w-0 text-sm leading-relaxed text-slate-600">{a.summary}</p>

                  <span className="mt-4 text-sm font-bold text-blue-600">Read it →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <CTABanner isLoggedIn={isLoggedIn} />
      <Footer />
    </main>
  );
}
