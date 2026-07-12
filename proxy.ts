/**
 * Next.js 16 Proxy (formerly "middleware") — runs before every matched request.
 *
 * Two jobs:
 *   1. SESSION REFRESH — keeps the Supabase auth cookies fresh so users
 *      aren't randomly logged out (required by @supabase/ssr).
 *   2. OPTIMISTIC ROUTE PROTECTION — quickly bounces anonymous visitors away
 *      from /dashboard and /admin, and logged-in users away from the auth
 *      pages. This is a UX shortcut only: the REAL security checks happen
 *      server-side in every layout and Server Action (lib/auth.ts), so
 *      bypassing the proxy gains an attacker nothing.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages a logged-in user shouldn't see again.
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror refreshed cookies onto both the request (for downstream
          // server code) and the response (for the browser).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() validates the JWT signature locally (asymmetric signing keys)
  // and refreshes the session if it has expired.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;

  // Anonymous visitor trying to open a protected area → send to login.
  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged-in user on an auth page → send to their dashboard.
  if (isLoggedIn && AUTH_PAGES.some((p) => path === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
