import { requireAdmin } from "@/lib/auth";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata = { title: "New article · Rydvest admin" };

export default async function NewArticlePage() {
  await requireAdmin();

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Write an article</h1>
        <p className="text-sm text-slate-500">
          Save it as a draft while you work. Nobody can read it until you publish.
        </p>
      </div>
      <ArticleEditor />
    </div>
  );
}
