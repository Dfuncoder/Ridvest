/**
 * The holding page production shows until launch. Reached by a rewrite from
 * proxy.ts, so it answers on every path while MAINTENANCE_MODE is on — the
 * visitor's URL is left alone.
 */
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Rydvest — launching October 2026",
  description:
    "Rydvest lets everyday Nigerians co-invest in commercial transport vehicles and earn weekly returns. Launching October 2026.",
  // Nothing here should be what search engines remember the site for.
  robots: { index: false, follow: false },
};

const WHATSAPP = "https://wa.me/2347065284100";
const EMAIL = "info@rydvest.com";

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0d2137] flex items-center justify-center px-6 py-16">
      {/* Radial washes rather than filter:blur — mobile GPUs glitch on extra
          composited layers. */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 w-[38rem] h-[38rem]"
        style={{ background: "radial-gradient(circle, rgba(250,204,21,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-48 -left-40 w-[34rem] h-[34rem]"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* ── Copy ── */}
        <div className="text-center lg:text-left">
          <p className="text-2xl font-extrabold text-white tracking-tight mb-8">
            Ryd<span className="text-amber-400">vest</span>
          </p>

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">
              Launching October 2026
            </span>
          </span>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-[-0.03em] leading-[1.05] mb-5">
            Own a piece of
            <br />
            the road.
          </h1>

          <p className="text-base text-slate-300/90 leading-relaxed max-w-md mx-auto lg:mx-0 mb-9">
            Rydvest lets everyday Nigerians co-invest in commercial transport vehicles and earn
            weekly returns. We&apos;re putting the finishing touches to the platform — it opens this
            October.
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-2xl transition-all duration-150 shadow-lg shadow-amber-400/25"
            >
              Talk to us on WhatsApp
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="w-full sm:w-auto text-center px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-sm rounded-2xl transition-colors"
            >
              {EMAIL}
            </a>
          </div>

          <p className="text-xs text-slate-500 mt-10">
            Rydvest Ltd · Anambra State, Nigeria
          </p>
        </div>

        {/* ── Vehicle ── */}
        <div className="relative flex justify-center lg:justify-end">
          <div
            className="pointer-events-none absolute inset-0 m-auto w-72 h-72 sm:w-96 sm:h-96"
            style={{ background: "radial-gradient(circle, rgba(250,204,21,0.14) 0%, transparent 68%)" }}
          />
          <Image
            src="/header_image-2.png"
            alt="A Rydvest keke"
            width={432}
            height={577}
            priority
            className="relative w-56 sm:w-72 lg:w-full lg:max-w-sm h-auto drop-shadow-2xl"
          />
        </div>
      </div>
    </main>
  );
}
