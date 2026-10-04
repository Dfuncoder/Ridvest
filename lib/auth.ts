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
 * Stamps the session as active, and reports whether it had gone idle.
 *
 * Returns true to let the request through. It returns false ONLY when the
 * database says, in those words, that the session passed the idle window —
 * never because the check itself could not run. Signing people out on an
 * inconclusive answer is how you lock everyone out of a platform holding their
 * money, so every other outcome fails open and is logged instead.
 *
 * Wrapped in React cache() so the several requireUser() calls that happen
 * while rendering one page cost a single round trip.
 */
const sessionIsLive = cache(async (): Promise<boolean> => {
  const minutes = idleTimeoutMinutes();

  // Disabled: do not even make the call, so there is no failure mode at all.
  if (minutes <= 0) return true;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("touch_session", {
    p_timeout_minutes: minutes,
  });

  if (error) {
    // Function missing (migration not run), network blip, bad signature.
    console.error("[auth] touch_session failed, allowing request:", error.message);
    return true;
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  if (result?.ok) return true;

  // The only reason worth ending a session over.
  if (result?.reason === "idle_timeout") return false;

  // not_authenticated, no_profile, or anything unexpected: our check is
  // unreliable here, so do not punish the user for it.
  console.error("[auth] touch_session inconclusive, allowing request:", result?.reason ?? "unknown");
  return true;
});

/**
 * Redirects to /login unless someone is logged in AND their session has been
 * used within the idle window. Called by every protected page and every server
 * action, so there is no path that skips the timeout.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Cookies cannot be cleared from here, so hand off to the route handler that
  // can. Redirecting straight to /login would leave the session cookie valid
  // and the proxy would bounce it back to the dashboard for ever.
  if (!(await sessionIsLive())) redirect("/auth/logout");

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
