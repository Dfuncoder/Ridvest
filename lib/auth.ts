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
 *
 * requireUser() also enforces the idle timeout (see lib/session.ts): Supabase
 * refresh tokens never expire, so without this a session would stay valid
 * forever.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { idleTimeoutMinutes } from "./session";

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

/**
 * Stamps the session as active, and reports whether it had already gone idle.
 *
 * Wrapped in React cache() so the several requireUser() calls that happen
 * while rendering one page (layout, page, nested components) cost a single
 * round trip. The write and the check happen together inside touch_session().
 */
const touchSession = cache(async (): Promise<boolean> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("touch_session", {
    p_timeout_minutes: idleTimeoutMinutes(),
  });

  // A failed call must not lock anyone out — if the function is missing
  // (migration not yet run) or the network blips, treat the session as live.
  if (error) {
    console.error("[auth] touch_session failed", error.message);
    return true;
  }

  return Boolean((data as { ok?: boolean } | null)?.ok);
});

/**
 * Redirects to /login unless someone is logged in AND their session has been
 * used within the idle window. Called by every protected page and every
 * server action, so there is no path that skips the timeout.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!(await touchSession())) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

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
