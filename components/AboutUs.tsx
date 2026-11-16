"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useIntersection(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useIntersection();
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transitionProperty: "opacity, transform",
        transitionDuration: "800ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}
    >
      {children}
    </div>
  );
}

const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    title: "Vehicle hire purchase and management",
    desc: "Buy a keke, motorcycle or other commercial vehicle while we handle the day-to-day management and maintenance.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Weekly payouts for 78 weeks",
    desc: "Our managed vehicle ownership programme is structured around scheduled weekly payouts over 78 weeks, roughly 18 months.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12A1.125 1.125 0 0119.75 21.75H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
    title: "Vehicle sales in Nigeria",
    desc: "Vehicle sales and automotive solutions, connecting individuals and businesses with vehicles that meet their personal, commercial and transportation needs.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    title: "The Rydvest roadmap",
    desc: "The future of transportation goes beyond buying and selling vehicles. We are connecting vehicle ownership, automotive sales, transportation, logistics and financial technology.",
  },
];

const operations = [
  "Vehicle acquisition and preparation",
  "Strict driver vetting and onboarding",
  "Comprehensive maintenance coverage",
  "Full insurance on every vehicle",
  "Real-time daily operations tracking",
];

export default function AboutUs({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <section id="about" className="relative bg-white py-24 sm:py-32 overflow-hidden">
      {/* Radial gradients instead of filter:blur — avoids mobile GPU artifacts. */}
      <div className="absolute top-0 left-0 w-125 h-125 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(239,246,255,0.9) 0%, transparent 65%)" }} />
      <div className="absolute bottom-0 right-0 w-100 h-100 translate-x-1/3 translate-y-1/3 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,251,235,0.95) 0%, transparent 65%)" }} />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        <FadeUp>
          <div className="flex items-center gap-2 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[3px] text-blue-700">About Rydvest</span>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-7">
            <FadeUp delay={50}>
              <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
                Building opportunities for{" "}
                <span className="text-blue-600">everyone</span>{" "}
                in the transportation industry.
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-medium mb-5">
                Rydvest is a Nigerian vehicle and mobility company, focused on making vehicle
                ownership, transport solutions and investment opportunities more accessible for
                individuals and businesses.
              </p>
              <p className="text-base text-slate-500 leading-relaxed">
                Our values are integrity, innovation, accessibility, accountability and customer
                commitment.
              </p>
            </FadeUp>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f, i) => (
                <FadeUp key={i} delay={150 + i * 80}>
                  <div className="group p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 h-full">
                    <div className="w-9 h-9 rounded-xl bg-[#0d2137] text-amber-400 flex items-center justify-center mb-4">
                      {f.icon}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{f.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <FadeUp delay={300}>
              <div className="rounded-[28px] bg-[#0d2137] p-8 sm:p-10 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 65%)" }} />
                <div className="absolute bottom-0 left-0 w-52 h-52 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)" }} />

                <h3 className="text-2xl font-extrabold text-white mb-3">
                  We remove every <span className="text-amber-400">barrier.</span>
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Buying and running a transport vehicle is expensive and stressful. We handle every part of the operation so you never have to worry about it.
                </p>

                <ul className="space-y-4 mb-8">
                  {operations.map((op, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-200 font-medium">
                      <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      {op}
                    </li>
                  ))}
                </ul>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
                  <div className="flex items-center justify-between">
                    {[
                      { who: "You", action: "Acquire" },
                      { who: "We", action: "Deploy" },
                      { who: "You", action: "Earn" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.who}</div>
                          <div className="text-base font-extrabold text-white">{item.action}</div>
                        </div>
                        {i < 2 && (
                          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Was a scroll to #invest, which lives in a section the home
                    page no longer renders — so the button did nothing at all.
                    It goes where the plans actually are now: the pools, or the
                    login wall that leads to them. */}
                <Link
                  href={isLoggedIn ? "/dashboard/pools" : "/login?next=/dashboard/pools"}
                  className="block w-full py-4 text-center bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-amber-400/20"
                >
                  See ownership plans →
                </Link>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
