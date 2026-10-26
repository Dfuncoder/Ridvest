/**
 * robots.txt — tells search engines to index the public marketing pages and
 * stay out of everything private or transactional. (Real protection is the
 * server-side auth on those routes; this just keeps them out of search
 * results and crawler logs.)
 */
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { maintenanceEnabled } from "@/lib/maintenance";

// Rendered per request, not baked in at build: MAINTENANCE_MODE is meant to be
// flipped without a redeploy, and a statically generated robots.txt would keep
// serving whatever the env var said when the build ran.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Pre-launch: keep the holding page out of search results entirely, so the
  // site is not first indexed as "coming soon".
  const host = (await headers()).get("host");
  if (maintenanceEnabled(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  // The test site is NOT blocked here on purpose. It is served with an
  // X-Robots-Tag: noindex header from proxy.ts instead, and a page Google is
  // forbidden to crawl is a page it can never be told to drop — the URLs would
  // sit in results indefinitely. Allow the crawl; the header does the work.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/api/",
        "/auth/",
        "/verify-otp",
        "/reset-password",
      ],
    },
    // Pointed at from here as well as submitted in Search Console: crawlers
    // other than Google find it this way, and it costs one line.
    sitemap: `https://${host ?? "rydvest.com"}/sitemap.xml`,
  };
}
