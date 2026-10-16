/**
 * Supabase client for SERVER code acting AS THE LOGGED-IN USER.
 *
 * Uses the publishable key plus the user's session (stored in httpOnly
 * cookies by @supabase/ssr). Every query made with this client is subject to
 * Row Level Security — the user can only ever see/change what the policies
 * in supabase/schema.sql allow.
 *
 * Use this in Server Components, Server Actions and Route Handlers whenever
 * you're reading/writing on behalf of the current user.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore: the proxy (proxy.ts) refreshes sessions.
          }
        },
      },
    }
  );
}

/**
 * A client that authenticates but does NOT keep the session.
 *
 * Used to check a password without logging anybody in. The first step of
 * two-step login has to confirm the password is right while leaving the
 * browser signed out — the session is only established once the emailed code
 * has also been accepted.
 *
 * Nothing is written to cookies, so a successful call here changes nothing
 * about who the browser is.
 */
export function createSupabaseCheckClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
