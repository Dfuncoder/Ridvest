/**
 * ADMIN → ARTICLES — everything written, drafts first in spirit if not in
 * order: the list is newest-edited first, which is where somebody picks up.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAllArticles, articleDate } from "@/lib/articles";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Articles · Rydvest admin" };
export const dynamic = "force-dynamic";

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

export default async function AdminArticlesPage() {
  await requireAdmin();
  const articles = await listAllArticles();

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">Articles</h1>
          <p className="text-sm text-slate-500">
            News and company updates. Published ones appear at /articles.
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="rounded-xl bg-[#0d2137] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#143352]"
        >
          Write an article
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {articles.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Nothing written yet. “Write an article” starts one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`px-5 py-2.5 ${eyebrow} text-slate-400`}>Title</th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>
                    Status
                  </th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>
                    Published
                  </th>
                  <th className={`px-5 py-2.5 ${eyebrow} whitespace-nowrap text-slate-400`}>
                    Last edited
                  </th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 transition-colors last:border-0 odd:bg-slate-50/60 hover:bg-amber-50/40"
                  >
                    <td className="px-5 py-3.5 align-middle">
                      <Link href={`/admin/articles/${a.id}`} className="group block min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 group-hover:underline">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          /articles/{a.slug} · {a.category}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          a.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {a.status === "published" ? "Live" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 align-middle text-xs whitespace-nowrap text-slate-500">
                      {articleDate(a.published_at) || "—"}
                    </td>
                    <td className="px-5 py-3.5 align-middle text-xs whitespace-nowrap text-slate-500">
                      {fmtDateTime(a.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
