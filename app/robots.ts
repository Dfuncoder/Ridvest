/**
 * robots.txt — tells search engines to index the public marketing pages and
 * stay out of everything private or transactional. (Real protection is the
 * server-side auth on those routes; this just keeps them out of search
 * results and crawler logs.)
 */
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
  };
}
