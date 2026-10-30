import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import WhatsAppFloat from "@/components/WhatsAppFloat";
import "./globals.css";

// Plus Jakarta Sans: geometric, warm, and its numerals read cleanly at the
// large sizes the balance figures use.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Used for references and the user code, where character shapes must be
// unambiguous.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Every absolute URL in the metadata below is resolved against this — Open
// Graph requires absolute URLs, and a relative canonical is resolved from it
// too. Falls back to the live domain so a deployment without the variable
// still produces working tags rather than silently dropping them.
const SITE = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://rydvest.com");

const TITLE = "Rydvest — Co-own transport assets, earn weekly";
const DESCRIPTION =
  "Rydvest lets everyday Nigerians co-own income-earning transport assets and take a weekly share of what they make. Fully managed, asset-backed, transparent.";

export const metadata: Metadata = {
  metadataBase: SITE,
  title: TITLE,
  description: DESCRIPTION,

  // Each page resolves this against its own route, so every URL states its
  // own address once. It is also what settles www against the bare domain
  // for search engines while both are being served.
  alternates: { canonical: "./" },

  // What WhatsApp, X and LinkedIn read when somebody shares a link. Without
  // these they fall back to whatever text they can scrape, which on a page of
  // navigation is usually nothing useful.
  openGraph: {
    type: "website",
    siteName: "Rydvest",
    locale: "en_NG",
    title: TITLE,
    description: DESCRIPTION,
    url: "./",
  },
  twitter: {
    // "summary" rather than "summary_large_image": there is no share image
    // yet, and claiming a large card without one renders as a blank slab.
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },

  // Google needs a square raster icon that is a multiple of 48px before it
  // will show one beside a search result, and it has to be crawlable. The SVG
  // stays first for browsers, which render it crisply at any size; the PNG is
  // what search engines and Android actually use. /favicon.ico exists too —
  // plenty of crawlers still ask for it by name and ignore these tags.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <WhatsAppFloat />
        <Analytics />
      </body>
    </html>
  );
}
