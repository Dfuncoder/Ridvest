"use client";

/**
 * THE TEAM — the three founders, with their faces.
 *
 * On a platform asking strangers for ₦500,000, who is behind it is not
 * decoration. Real names and real photographs are the point of the page, so
 * the portraits lead and everything else sits under them.
 *
 * The images are 4:5 portraits shot against different backgrounds, so each is
 * cropped to a consistent 4:5 frame with a uniform tint behind it. Without
 * that the row reads as three unrelated pictures rather than one team.
 */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Member = {
  name: string;
  role: string;
  title: string;
  photo: string;
};

const TEAM: Member[] = [
  {
    name: "Atansi Johnbosco",
    role: "Co-founder",
    title: "CEO / Public Relations",
    photo: "/team-johnbosco.jpg",
  },
  {
    name: "Mbakwe Austine",
    role: "Co-founder",
    title: "Chief Operations Manager",
    photo: "/team-austine.jpg",
  },
  {
    name: "Meputaife Joseph",
    role: "Co-founder",
    title: "CMO / Growth & Partnerships",
    photo: "/team-joseph.jpg",
  },
];

function useIntersection(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
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

export default function Team() {
  return (
    <section className="bg-white px-5 py-[clamp(48px,9vw,88px)]">
      <div className="mx-auto max-w-6xl">
        {/* ── Heading ── */}
        <FadeUp>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#2563a8]">
              Who we are
            </p>
            <h1 className="mb-4 text-[clamp(28px,5.5vw,42px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-slate-900">
              The people behind Rydvest
            </h1>
            <p className="text-base leading-relaxed text-slate-500">
              Three co-founders, building a transport investment platform on Nigerian roads —
              with our names and faces on it.
            </p>
          </div>
        </FadeUp>

        {/* ── The three ── */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m, i) => (
            <FadeUp key={m.name} delay={i * 120}>
              <article className="group h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-300/40">
                {/* One frame for all three, whatever the original backdrop. */}
                <div className="relative aspect-4/5 w-full overflow-hidden bg-slate-100">
                  <Image
                    src={m.photo}
                    alt={`${m.name}, ${m.role}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    priority={i === 0}
                  />
                </div>

                <div className="p-5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-500">
                    {m.role}
                  </p>
                  <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
                    {m.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{m.title}</p>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>

        {/* ── Why this page exists ── */}
        <FadeUp delay={360}>
          <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-slate-200/80 bg-slate-50/70 px-6 py-6 text-center">
            <p className="text-sm leading-relaxed text-slate-600">
              Money is easy to ask for and hard to trust. You can see who we are, and you can
              reach us.{" "}
              <a
                href="/contact"
                className="font-semibold text-[#2563a8] underline-offset-2 hover:underline"
              >
                Talk to us
              </a>
              .
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
