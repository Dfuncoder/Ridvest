/**
 * Signs the session out and sends the user to the login page.
 *
 * This exists because a Server Component cannot clear cookies — the setAll in
 * lib/supabase/server.ts has to swallow the attempt. So requireUser() cannot
 * end a session itself; it sends the browser here, and a Route Handler, which
 * IS allowed to write cookies, does the actual sign-out.
 *
 * Without this the idle check could only redirect to /login while leaving the
 * cookies in place, and the proxy would bounce the still-valid session
 * straight back to the dashboard — a redirect loop.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
