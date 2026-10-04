/**
 * Next.js 16 Proxy (formerly "middleware") — runs before every matched request.
 *
 * Three jobs:
 *   0. MAINTENANCE GATE — while MAINTENANCE_MODE is on, every page is
 *      rewritten to the launch page. Checked first and returns early, so the
 *      holding page costs nothing beyond a string comparison.
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
import {
  maintenanceEnabled,
  bypassToken,
  alwaysAllowed,
  BYPASS_COOKIE,
} from "@/lib/maintenance";

// Pages a logged-in user shouldn't see again.
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/** Routes where a session actually matters. Everything else skips the work. */
function needsSession(path: string): boolean {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    AUTH_PAGES.includes(path) ||
    path === "/reset-password" ||
    path === "/verify-otp"
  );
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── 0. Maintenance gate ──────────────────────────────────────────────────
  if (maintenanceEnabled(request.headers.get("host")) && !alwaysAllowed(path)) {
    const token = bypassToken();
    const offered = request.nextUrl.searchParams.get("preview");

    // ?preview=off drops the cookie again, so you can check what visitors
    // actually see without hunting through browser settings.
    if (offered === "off") {
      const cleared = NextResponse.rewrite(new URL("/maintenance", request.url));
      cleared.cookies.delete(BYPASS_COOKIE);
      return cleared;
    }

    // ?preview=<token> drops a cookie so the rest of the session sees the
    // real site. Without a token configured there is no way through.
    if (token && offered === token) {
      const through = NextResponse.redirect(new URL(path, request.url));
      through.cookies.set(BYPASS_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return through;
    }

    const holdsPass = token && request.cookies.get(BYPASS_COOKIE)?.value === token;
    if (!holdsPass) {
      // Rewrite, not redirect: the visitor's URL is left as they typed it.
      return NextResponse.rewrite(new URL("/maintenance", request.url));
    }
  }

  // Public pages need no Supabase client at all.
  if (!needsSession(path)) return NextResponse.next({ request });

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

  // Everything except Next's own output and static files. The gate has to see
  // every page; needsSession() above keeps the session work off public routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
