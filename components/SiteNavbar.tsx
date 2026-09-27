/**
 * The public navbar, with the session already resolved.
 *
 * Navbar itself is a client component (scroll state, mobile menu), so the
 * session check happens here and is passed down as a plain boolean. Reading
 * the session cookie makes the pages that use this render per-request rather
 * than statically — worth it, since showing "Login" to someone already signed
 * in is worse than a few milliseconds of TTFB.
 */
import { getSessionUser } from "@/lib/auth";
import Navbar from "./Navbar";

export default async function SiteNavbar() {
  const user = await getSessionUser();
  return <Navbar isLoggedIn={Boolean(user)} />;
}
