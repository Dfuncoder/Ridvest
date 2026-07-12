import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 * These harden the app against clickjacking, MIME sniffing, and leaky
 * referrers, and lock down browser features we don't use.
 */
const securityHeaders = [
  // Never allow the site to be embedded in an <iframe> (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must respect the declared Content-Type (no MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // We don't use these browser features at all.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Force HTTPS for two years once visited over HTTPS (Vercel serves HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
