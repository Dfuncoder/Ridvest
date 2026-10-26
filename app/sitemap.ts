/**
 * sitemap.xml — the public pages, and only those.
 *
 * It lists what we want crawled, which is the exact set robots.txt allows:
 * the marketing and policy pages. Nothing behind the login wall, nothing
 * transactional, no auth screens. A sitemap is a request, not a permission —
 * listing a private URL here would not expose it, but it would advertise it,
 * and the two lists disagreeing is how a page ends up crawled by accident.
 *
 * Two cases return nothing at all:
 *   • the holding page is up — robots.txt says Disallow: / at the same time,
 *     and handing Google a list of pages it is forbidden to fetch is a
 *     contradiction it reports as an error;
 *   • the test site — every page there is served noindex, so inviting a crawl
 *     would only slow down getting it out of the index.
 *
 * Host comes from the request, so each deployment lists its own URLs. A
 * sitemap that names another host is ignored by every search engine.
 */
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { maintenanceEnabled, isNonProductionHost } from "@/lib/maintenance";

// Read per request for the same reason robots.txt is: the maintenance flag is
// meant to change without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Priority is relative, within this site only — it tells Google what matters
 * most here, not how this site compares to any other.
 */
const PAGES: Array<{ path: string; priority: number; changeFrequency: "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/how-it-works", priority: 0.9, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/team", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host = headerList.get("host");

  if (maintenanceEnabled(host) || isNonProductionHost(host)) return [];

  // x-forwarded-proto rather than an assumption: localhost is http, and a
  // sitemap full of https://localhost:3000 URLs is a confusing thing to debug.
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const base = `${protocol}://${host ?? "rydvest.com"}`;

  // lastModified is deliberately absent. The honest value is "when the page
  // last changed", which we do not track, and stamping every page with today
  // on every request tells Google the whole site changes hourly — a claim it
  // learns to ignore.
  return PAGES.map((page) => ({
    url: `${base}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
