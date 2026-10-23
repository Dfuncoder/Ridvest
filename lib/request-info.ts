/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE A REQUEST CAME FROM — for the sign-in notice.
 *
 * Everything here is read from request headers, which the client controls.
 * That is fine for what it is used for: telling somebody "this is what the
 * sign-in looked like" so THEY can say whether it was them. It is evidence
 * for a human, not an authentication factor, and nothing is ever decided on
 * the strength of it.
 *
 * The browser and OS come from the user-agent string, which is a mess by
 * design — every browser pretends to be several others. The parsing below is
 * deliberately shallow: it answers "Chrome on Android" well enough for
 * somebody to recognise their own phone, and gives up gracefully rather than
 * guessing. A full UA database would be a dependency and a maintenance
 * burden for a line of text in an email.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";
import { headers } from "next/headers";

export type RequestInfo = {
  /** Best guess at the caller's address, or null behind an odd proxy. */
  ip: string | null;
  /** "Lagos, Nigeria" where the platform tells us, else null. */
  location: string | null;
  /** "Chrome on Android" — short enough to read in a sentence. */
  device: string;
  /** The raw string, kept for the audit record rather than the email. */
  userAgent: string | null;
};

/** Browsers, most specific first: they all claim to be the ones below them. */
const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//i, "Edge"],
  [/\bOPR\/|\bOpera\//i, "Opera"],
  [/\bSamsungBrowser\//i, "Samsung Internet"],
  [/\bFxiOS\/|\bFirefox\//i, "Firefox"],
  [/\bCriOS\//i, "Chrome"],
  [/\bChrome\//i, "Chrome"],
  [/\bSafari\//i, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\bAndroid\b/i, "Android"],
  [/\b(iPhone|iPad|iPod)\b/i, "iOS"],
  [/\bWindows NT\b/i, "Windows"],
  [/\b(Macintosh|Mac OS X)\b/i, "Mac"],
  [/\b(CrOS)\b/i, "ChromeOS"],
  [/\bLinux\b/i, "Linux"],
];

/** "Chrome on Android", "Safari on iOS", or "Unknown device". */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];

  if (browser && system) return `${browser} on ${system}`;
  if (browser) return browser;
  if (system) return system;
  return "Unknown device";
}

/**
 * Turns an ISO country code into a name, because "Lagos, NG" reads like a
 * form field and "Lagos, Nigeria" reads like a place. Intl is built in, so
 * this costs nothing; if a runtime ships without the data the code itself is
 * still better than a blank.
 */
function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * Reads the caller's address, location and device from the current request.
 *
 * x-forwarded-for is a comma-separated chain and the FIRST entry is the
 * original client; everything after it is proxies. Taking the last one — a
 * common mistake — reports our own edge server back to the user.
 */
export async function requestInfo(): Promise<RequestInfo> {
  const h = await headers();

  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    null;

  // Vercel resolves these at the edge at no cost to us. Absent elsewhere,
  // which is why every one is optional.
  const city = h.get("x-vercel-ip-city");
  const country = h.get("x-vercel-ip-country");
  const location =
    [city ? decodeURIComponent(city) : null, countryName(country)].filter(Boolean).join(", ") || null;

  const userAgent = h.get("user-agent");

  return { ip, location, device: describeDevice(userAgent), userAgent };
}
