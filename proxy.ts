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
import { safeNextPath } from "@/lib/redirects";

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

  // Anonymous visitor trying to open a protected area → send to login,
  // remembering where they were going so the login can return them there.
  // Without this, a one-time link (e.g. a transfer confirmation) is lost the
  // moment the session cookie is missing.
  if (!isLoggedIn && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    const intended = safeNextPath(path + request.nextUrl.search);
    url.pathname = "/login";
    url.search = intended ? `?next=${encodeURIComponent(intended)}` : "";
    return NextResponse.redirect(url);
  }

  // Logged-in user on an auth page → on to wherever they were headed.
  if (isLoggedIn && AUTH_PAGES.some((p) => path === p)) {
    const intended = safeNextPath(request.nextUrl.searchParams.get("next"));
    const url = request.nextUrl.clone();
    url.search = "";
    if (intended) {
      const target = new URL(intended, request.nextUrl.origin);
      url.pathname = target.pathname;
      url.search = target.search;
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Only run where a session matters: protected areas + auth pages.
  // Public pages (landing, about, FAQ, ...) skip the proxy entirely, which
  // keeps their time-to-first-byte as fast as possible.
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
  ],
};
