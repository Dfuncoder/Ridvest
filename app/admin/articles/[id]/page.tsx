import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findAnyArticle } from "@/lib/articles";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata = { title: "Edit article · Rydvest admin" };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const article = await findAnyArticle(id);
  if (!article) notFound();

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Edit article</h1>
        <p className="text-sm text-slate-500">
          {article.status === "published"
            ? "This one is live — changes appear as soon as you save."
            : "A draft. Nobody can read it until you publish."}
        </p>
      </div>
      <ArticleEditor article={article} />
    </div>
  );
}
