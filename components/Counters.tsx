"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 2000, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  return value;
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${Math.floor(n / 1_000)}k`;
  return `₦${n}`;
}

export default function Counters() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const invested = useCountUp(48_500_000, 2200, started);
  const teams = useCountUp(312, 1800, started);
  const payouts = useCountUp(9_200_000, 2000, started);
  const kekes = useCountUp(87, 1600, started);

  return (
    <>
      {/* Amber strip */}
      <div style={{ background: "#f59e0b", padding: "20px 20px", display: "flex", justifyContent: "center", gap: "20px 60px", flexWrap: "wrap" }}>
        {[
          { label: "TOTAL INVESTED", value: fmtCurrency(invested) },
          { label: "INVESTORS ONBOARDED", value: teams.toLocaleString() },
          { label: "KEKES DEPLOYED", value: kekes.toLocaleString() },
          { label: "TOTAL PAYOUTS MADE", value: fmtCurrency(payouts) },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, color: "#0d2137" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "rgba(13,33,55,0.65)", fontWeight: 600, letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Counter cards */}
      <section ref={ref} style={{ padding: "clamp(40px, 8vw, 72px) 20px", background: "#fff" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 12, color: "#2563a8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>By the numbers</div>
          <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 12 }}>Growing every day</h2>
          <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>Real numbers from real investors earning real returns on Nigeria's roads.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
          {[
            { icon: "💰", value: fmtCurrency(invested), label: "TOTAL MONEY INVESTED" },
            { icon: "👥", value: teams.toLocaleString(), label: "TEAMS / INVESTORS FORMED" },
            { icon: "📈", value: fmtCurrency(payouts), label: "INTEREST PAYOUTS MADE" },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: "#0d2137",
                borderRadius: 18,
                padding: "36px 24px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                borderTop: "3px solid #f59e0b",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{c.icon}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>{c.value}</div>
              <div style={{ fontSize: 13, color: "#93c5fd", marginTop: 6, fontWeight: 500, letterSpacing: "0.5px" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
