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

const steps = [
  {
    n: "01",
    title: "Create your account",
    desc: "Sign up in minutes. Verify your identity and link your bank account. The whole thing takes less than 5 minutes.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Pick how you want to invest",
    desc: "Own a keke outright on your own, or join a public or private pool with others from as little as ₦100,000.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Fund your investment",
    desc: "Transfer your amount directly from your bank. Once confirmed, we get to work immediately — no waiting around.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "We acquire and deploy",
    desc: "We buy the keke, vet and assign a verified driver, and handle all operations from day one. You just get updates.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    n: "05",
    title: "Collect monthly returns",
    desc: "Every month for 12 months, your returns are paid directly to your bank. Track everything live on your dashboard.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
      </svg>
    ),
  },
  {
    n: "06",
    title: "Get your capital back",
    desc: "At month 12, your original investment is returned in full. Then you choose — reinvest, join a new pool, or exit.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const poolTypes = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    label: "Public pool",
    wrapClass: "bg-blue-50 border-blue-100",
    textClass: "text-blue-700",
    iconBg: "bg-blue-100 text-blue-700",
    desc: "Open to everyone on the platform. Browse, pick a pool, add your amount.",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    label: "Private pool",
    wrapClass: "bg-amber-50 border-amber-100",
    textClass: "text-amber-700",
    iconBg: "bg-amber-100 text-amber-700",
    desc: "Invite only. Create a pool and share the link with people you trust.",
  },
];

const timeline = [
  { when: "Day 1", title: "Investment confirmed", sub: "Keke acquired, driver assigned" },
  { when: "Month 1–11", title: "Monthly returns paid", sub: "Directly to your bank, every 30 days" },
  { when: "Month 12", title: "Final payout + capital back", sub: "Your original money returned in full" },
  { when: "After year 1", title: "Your choice", sub: "Reinvest, join a new pool, or exit" },
];

export default function HowItWorks() {
  return (
    <section id="hiw" className="relative bg-[#f8faff] py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-50 rounded-full blur-[140px] opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">

        <FadeUp>
          <div className="max-w-2xl mb-16">
            <div className="flex items-center gap-2 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[3px] text-blue-700">How it works</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 leading-[1.05] tracking-tight mb-6">
              Six steps from sign-up<br />
              to <span className="text-blue-600">earning.</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              No keke driving. No operations. No headaches. You handle the money — we handle everything else.
            </p>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {steps.map((s, i) => (
            <FadeUp key={i} delay={i * 80}>
              <div className="group relative h-full p-7 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
                <div className="absolute top-5 right-6 text-[64px] font-black text-slate-50 leading-none select-none group-hover:text-blue-50 transition-colors">
                  {s.n}
                </div>
                <div className="relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-[#0d2137] text-amber-400 flex items-center justify-center mb-5">
                    {s.icon}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={200}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white border border-slate-100 rounded-2xl p-8">
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Three ways to invest</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Whether you want full ownership or prefer to pool with others, the returns and the structure work the same way.
              </p>

              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-[#0d2137] text-amber-400 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 mb-1">Full ownership</div>
                    <div className="text-xs text-slate-500 leading-relaxed">Pay the full keke cost yourself. You own it alone and keep all the returns.</div>
                  </div>
                </div>

                {poolTypes.map((p, i) => (
                  <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${p.wrapClass}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.iconBg}`}>
                      {p.icon}
                    </div>
                    <div>
                      <div className={`text-sm font-bold mb-1 ${p.textClass}`}>{p.label}</div>
                      <div className={`text-xs leading-relaxed opacity-80 ${p.textClass}`}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  Minimum to join a pool: <span className="font-black text-amber-900">₦100,000</span>
                </p>
              </div>
            </div>

            <div className="bg-[#0d2137] rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-400 opacity-[0.05] blur-3xl rounded-full pointer-events-none" />

              <h3 className="text-lg font-extrabold text-white mb-2">The 12-month cycle</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">Every investment — pool or full ownership — runs for exactly one year.</p>

              <div className="flex flex-col">
                {timeline.map((t, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i < timeline.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-px bg-white/10" />
                    )}
                    <div className={`w-[18px] h-[18px] rounded-full border-2 border-[#0d2137] shrink-0 z-10 mt-1 ${i < timeline.length - 1 ? "bg-amber-400" : "bg-slate-600"}`} />
                    <div className="pb-6">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">{t.when}</div>
                      <div className="text-sm font-bold text-white">{t.title}</div>
                      <div className="text-xs text-slate-500">{t.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => document.getElementById("invest")?.scrollIntoView({ behavior: "smooth" })}
                className="mt-4 w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-200"
              >
                Start investing →
              </button>
            </div>

          </div>
        </FadeUp>

      </div>
    </section>
  );
}
