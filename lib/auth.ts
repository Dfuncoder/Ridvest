/**
 * Authentication / authorization guards for server code.
 *
 * EVERY Server Action and protected page calls one of these first:
 *   • requireUser()  — throws a redirect to /login if not authenticated.
 *   • requireAdmin() — additionally requires profiles.role = 'admin';
 *                      non-admins are bounced to the user dashboard.
 *
 * Never trust anything from the client for identity — the user id always
 * comes from the verified session JWT, never from a form field.
 */
import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  email: string;
};

/** Returns the logged-in user or null. Verifies the JWT signature. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  // getClaims() verifies the JWT against the project's public signing keys
  // (Supabase's modern asymmetric JWT setup) — no extra network round-trip
  // on every call, unlike getUser().
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string) ?? "" };
}

/** Redirects to /login unless someone is logged in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The logged-in user's profile row (RLS lets users read their own row).
 * Returns null if the profile hasn't been created yet.
 */
export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}

/** Redirects to /login (not logged in) or /dashboard (not an admin). */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");
  return { user, profile };
}
