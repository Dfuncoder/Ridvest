"use server";

/**
 * Writing, publishing and removing articles.
 *
 * Every one of these runs behind requireAdmin() and writes with the service
 * role, because the table has no write policy at all — there is no path to
 * creating an article through the API, only through here.
 *
 * Publishing revalidates the public pages by hand. They are rendered per
 * request, so this is belt and braces rather than the mechanism, but a
 * published article that takes a minute to appear reads as a bug to the
 * person who just pressed the button.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArticleSchema, fieldErrors } from "@/lib/validation";
import { ERRORS } from "@/lib/errors";
import type { FormState } from "./auth";

/** Postgres' unique-violation code, for the one constraint that users hit. */
const UNIQUE_VIOLATION = "23505";

function refreshPublicPages(slug: string) {
  revalidatePath("/articles");
  revalidatePath(`/articles/${slug}`);
  revalidatePath("/sitemap.xml");
}

async function audit(actorId: string, action: string, target: string, detail: object) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({ actor_id: actorId, action, target, detail });
}

/** Create a new article, or save changes to one. */
export async function saveArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  const parsed = ArticleSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    category: formData.get("category"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const d = parsed.data;
  const admin = createSupabaseAdminClient();

  const row = {
    slug: d.slug,
    title: d.title,
    summary: d.summary,
    body: d.body,
    category: d.category,
    status: d.status,
  };

  const { error } = id
    ? await admin.from("articles").update(row).eq("id", id)
    : await admin.from("articles").insert({ ...row, created_by: user.id });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { errors: { slug: ERRORS.ARTICLE_SLUG_TAKEN } };
    }
    console.error("[articles] save failed", error.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, id ? "article.update" : "article.create", d.slug, {
    title: d.title,
    status: d.status,
  });

  refreshPublicPages(d.slug);
  revalidatePath("/admin/articles");

  return {
    success: true,
    message:
      d.status === "published"
        ? `Published. It is live at /articles/${d.slug}.`
        : "Saved as a draft. Nobody can see it until you publish.",
  };
}

/** Publish a draft, or take a published article back down. */
export async function setArticleStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("status") ?? "");
  if (!id || (next !== "published" && next !== "draft")) {
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("articles")
    .update({ status: next })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error || !data) {
    console.error("[articles] status change failed", error?.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, `article.${next}`, data.slug as string, {});

  refreshPublicPages(data.slug as string);
  revalidatePath("/admin/articles");

  return {
    success: true,
    message: next === "published" ? "Published." : "Taken down. It is a draft again.",
  };
}

/**
 * Delete an article outright.
 *
 * Deliberately available only from the edit screen, where whoever presses it
 * has the piece in front of them — a delete button on a list is a delete
 * button pressed on the wrong row.
 */
export async function deleteArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: ERRORS.ADMIN_ACTION_FAILED };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("articles")
    .delete()
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error("[articles] delete failed", error.message);
    return { message: ERRORS.ADMIN_ACTION_FAILED };
  }

  await audit(user.id, "article.delete", (data?.slug as string) ?? id, {});

  if (data?.slug) refreshPublicPages(data.slug as string);
  revalidatePath("/admin/articles");

  return { success: true, message: "Deleted." };
}
