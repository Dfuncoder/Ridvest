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

export const metadata: Metadata = {
  title: "Rydvest - Co-own a keke, earn consistent weekly earnings",
  description: "Rydvest lets everyday Nigerians co-own tricycles and earn consistent weekly earnings — fully managed, asset-backed, and transparent.  ",
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
