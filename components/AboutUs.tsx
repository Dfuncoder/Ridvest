"use client";

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
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
      </svg>
    ),
    title: "Structured returns",
    desc: "No informal arrangements. Every naira is tracked, every payout is scheduled and transparent.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Monthly payouts",
    desc: "Returns hit your bank account every 30 days — consistent, predictable, no chasing anyone.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Capital protected",
    desc: "After 12 months of earning, your original investment is returned to you in full.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: "Real, physical asset",
    desc: "Your investment is backed by an actual keke on actual Nigerian roads — not a digital promise.",
  },
];

const operations = [
  "Vehicle acquisition and preparation",
  "Strict driver vetting and onboarding",
  "Comprehensive maintenance coverage",
  "Full insurance on every vehicle",
  "Real-time daily operations tracking",
];

export default function AboutUs() {
  return (
    <section id="about" className="relative bg-white py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-[120px] opacity-50 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50 rounded-full blur-[100px] opacity-60 translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        <FadeUp>
          <div className="flex items-center gap-2 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[3px] text-blue-700">About Ridvest</span>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-7">
            <FadeUp delay={50}>
              <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
                The asset that was{" "}
                <span className="text-blue-600">always on</span>{" "}
                your street.
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-medium mb-5">
                Keke napeps have moved millions of Nigerians for decades. They run every day, earn every day, and stop for nothing. But everyday people never had a clean way to profit from them.
              </p>
              <p className="text-base text-slate-500 leading-relaxed">
                Ridvest changes that. We built the structure so you can own a stake in a keke, collect monthly returns for a year, and walk away with your capital intact — without touching a steering wheel.
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
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-400 opacity-[0.06] blur-3xl rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500 opacity-[0.06] blur-3xl rounded-full pointer-events-none" />

                <h3 className="text-2xl font-extrabold text-white mb-3">
                  We remove every <span className="text-amber-400">barrier.</span>
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Buying and running a keke is expensive and stressful. We handle every part of the operation so you never have to worry about it.
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
                      { who: "You", action: "Invest" },
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

                <button
                  onClick={() => document.getElementById("invest")?.scrollIntoView({ behavior: "smooth" })}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-amber-400/20"
                >
                  See investment plans →
                </button>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
