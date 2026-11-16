/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARTICLES — news around transportation, and about Rydvest.
 *
 * Written and published from /admin/articles, stored in the database.
 *
 * The public reads come through the ordinary (anon) client on purpose, so the
 * row-level policy is what decides what a visitor sees — not a `status` check
 * written in TypeScript that somebody could later forget on a new query. A
 * draft is invisible because the database says so.
 *
 * `body` is plain text: a blank line starts a new paragraph and a line
 * beginning "## " is a subheading. Nothing else is markup, deliberately — a
 * page that renders raw HTML typed into a form is a place for a script to end
 * up, even when everyone with the form is trusted.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";

export type ArticleCategory = "News" | "Company";
export type ArticleStatus = "draft" | "published";

export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: ArticleCategory;
  status: ArticleStatus;
  published_at: string | null;
  updated_at: string;
};

const COLUMNS = "id, slug, title, summary, body, category, status, published_at, updated_at";

/** Published only, newest first. Safe for any visitor. */
export async function listPublished(limit = 50): Promise<Article[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select(COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    // An empty page is a better failure than a crashed one: the rest of the
    // site keeps working and the reason is in the log.
    console.error("[articles] could not list", error.message);
    return [];
  }
  return (data ?? []) as Article[];
}

/** One published article, or null. */
export async function findPublished(slug: string): Promise<Article | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("articles")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return (data as Article | null) ?? null;
}

/** Everything, drafts included. Service role — admin screens only. */
export async function listAllArticles(): Promise<Article[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("articles")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[articles] could not list for admin", error.message);
    return [];
  }
  return (data ?? []) as Article[];
}

export async function findAnyArticle(id: string): Promise<Article | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("articles").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as Article | null) ?? null;
}

/**
 * A title turned into a URL-safe slug.
 *
 * Offered as a starting point in the admin form, never applied behind
 * somebody's back: the slug is the permanent address of the piece.
 */
export function slugify(title: string): string {
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

/** "26 October 2026" — long form, because a news page is not a dashboard. */
export function articleDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}
