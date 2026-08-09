"use client";

/**
 * Floating "chat with us" button — fixed bottom-right, opens WhatsApp
 * (+234 706 528 4100) with a pre-filled greeting in a new tab.
 *
 * Shown on the public site and auth pages; hidden inside /dashboard and
 * /admin where it would overlap the app UI (those users have the in-app
 * contact channels).
 */
import { usePathname } from "next/navigation";

const WHATSAPP_URL =
  "https://wa.me/2347065284100?text=" +
  encodeURIComponent("Hello Rydvest! I'd like to know more about investing.");

export default function WhatsAppFloat() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 group"
    >
      {/* Soft pulse ring behind the button (brand amber) */}
      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-40 animate-ping group-hover:animate-none" aria-hidden="true" />

      {/* Brand-amber button with a chat bubble in brand navy */}
      <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-amber-400 shadow-lg shadow-black/25 transition-transform duration-150 group-hover:scale-110 group-active:scale-95">
        <svg viewBox="0 0 24 24" fill="none" stroke="#0d2137" strokeWidth={1.9} className="w-7 h-7" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>

        {/* WhatsApp-green "online" dot — signals where the chat opens */}
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] border-2 border-white" aria-hidden="true" />
      </span>

      {/* Tooltip on hover (desktop) */}
      <span className="absolute right-full top-1/2 -translate-y-1/2 mr-3 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#0d2137] text-white text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
        Chat with us on WhatsApp
      </span>
    </a>
  );
}
