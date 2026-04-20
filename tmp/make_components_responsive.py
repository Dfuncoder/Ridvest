from pathlib import Path

files = {
    "components/Navbar.tsx": r'''\"use client\";

export default function Navbar() {
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <nav
        className="ridvest-navbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px clamp(16px,4vw,24px)",
          minHeight: 64,
          background: "#0d2137",
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "clamp(20px,4vw,22px)",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -0.5,
          }}
        >
          Rid<span style={{ color: "#f59e0b" }}>vest</span>
        </span>

        <div
          className="ridvest-navbar__actions"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginLeft: "auto",
          }}
        >
          <button
            onClick={() => go("invest")}
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,.72)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 6px",
              whiteSpace: "nowrap",
            }}
          >
            Invest
          </button>
          <button
            onClick={() => go("calc")}
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,.72)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 6px",
              whiteSpace: "nowrap",
            }}
          >
            Calculator
          </button>
          <button
            onClick={() => go("invest")}
            style={{
              background: "#f59e0b",
              color: "#0d2137",
              border: "none",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Get started
          </button>
        </div>
      </nav>

      <style>{`
        @media (max-width: 640px) {
          .ridvest-navbar {
            justify-content: center;
          }

          .ridvest-navbar__actions {
            width: 100%;
            margin-left: 0;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
''',

    "components/Hero.tsx": r'''\"use client\";

export default function Hero() {
  return (
    <section
      className="hero-section"
      style={{
        background: "linear-gradient(135deg,#060f1a 0%,#0d2137 50%,#0f2e52 100%)",
        minHeight: "92vh",
        display: "flex",
        alignItems: "center",
        padding: "80px clamp(20px,5vw,40px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "min(500px, 55vw)",
          height: "min(500px, 55vw)",
          borderRadius: "50%",
          background: "#2563a8",
          top: -100,
          right: -100,
          filter: "blur(80px)",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "min(400px, 48vw)",
          height: "min(400px, 48vw)",
          borderRadius: "50%",
          background: "#f59e0b",
          bottom: -150,
          left: -100,
          filter: "blur(80px)",
          opacity: 0.1,
          pointerEvents: "none",
        }}
      />

      <div
        className="hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(280px,480px)",
          gap: 60,
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div className="hero-copy">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.35)",
              color: "#fbbf24",
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 100,
              marginBottom: 24,
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f59e0b",
                animation: "pulse 1.5s infinite",
              }}
            />
            NOW LIVE IN ANAMBRA STATE
          </div>

          <h1
            style={{
              fontSize: "clamp(34px,7vw,52px)",
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: -1,
            }}
          >
            Turn <span style={{ color: "#f59e0b" }}>₦100k</span> into a keke that earns
            for you
          </h1>

          <p
            style={{
              fontSize: "clamp(15px,2.6vw,17px)",
              color: "#94a3b8",
              lineHeight: 1.75,
              marginBottom: 36,
              maxWidth: 480,
            }}
          >
            Ridvest lets everyday Nigerians co-invest in tricycles and earn consistent
            monthly returns — fully managed, asset-backed, and transparent.
          </p>

          <div
            className="hero-actions"
            style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <button
              onClick={() =>
                document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                background: "#f59e0b",
                color: "#0d2137",
                border: "none",
                padding: "15px 30px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              Start investing →
            </button>
            <button
              onClick={() =>
                document.getElementById("calc")?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                background: "transparent",
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.25)",
                padding: "15px 28px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Calculate returns
            </button>
          </div>
        </div>

        <div className="hero-visual" style={{ position: "relative" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "clamp(18px,3vw,28px)",
              backdropFilter: "blur(10px)",
            }}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Keke_Napep_in_Ibadan.jpg/1280px-Keke_Napep_in_Ibadan.jpg"
              alt="Keke Napep"
              style={{
                width: "100%",
                borderRadius: 14,
                height: "clamp(220px,42vw,320px)",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>

          <div
            className="hero-floating hero-floating--top"
            style={{
              position: "absolute",
              top: -20,
              right: -10,
              background: "rgba(13,33,55,0.92)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "14px 18px",
              backdropFilter: "blur(12px)",
              animation: "float 3s ease-in-out infinite",
              maxWidth: 220,
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>
              Monthly payout
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>₦4,167</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>↑ on ₦200k invested</div>
          </div>

          <div
            className="hero-floating hero-floating--bottom"
            style={{
              position: "absolute",
              bottom: -16,
              left: -10,
              background: "rgba(13,33,55,0.92)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "14px 18px",
              backdropFilter: "blur(12px)",
              animation: "float 3s ease-in-out infinite",
              animationDelay: "1.5s",
              maxWidth: 220,
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>
              Annual ROI
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>25%</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>Fixed rate · Asset-backed</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        @media (max-width: 920px) {
          .hero-section {
            min-height: auto;
            padding-top: 64px;
            padding-bottom: 72px;
          }

          .hero-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .hero-copy {
            text-align: center;
          }

          .hero-copy p {
            margin-left: auto;
            margin-right: auto;
          }

          .hero-actions {
            justify-content: center;
          }

          .hero-visual {
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
          }

          .hero-floating--top {
            top: 14px !important;
            right: 14px !important;
          }

          .hero-floating--bottom {
            bottom: 14px !important;
            left: 14px !important;
          }
        }

        @media (max-width: 560px) {
          .hero-actions {
            flex-direction: column;
          }

          .hero-actions button {
            width: 100%;
          }

          .hero-floating {
            position: static !important;
            max-width: none !important;
            margin-top: 12px;
          }

          .hero-visual {
            display: flex;
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
''',

    "components/Counters.tsx": r'''\"use client\";

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
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
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
      <div
        style={{
          background: "#f59e0b",
          padding: "20px clamp(16px,4vw,40px)",
          display: "flex",
          justifyContent: "center",
          gap: "clamp(20px,5vw,60px)",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "TOTAL INVESTED", value: fmtCurrency(invested) },
          { label: "INVESTORS ONBOARDED", value: teams.toLocaleString() },
          { label: "KEKES DEPLOYED", value: kekes.toLocaleString() },
          { label: "TOTAL PAYOUTS MADE", value: fmtCurrency(payouts) },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center", minWidth: 120 }}>
            <div
              style={{
                fontSize: "clamp(22px,5vw,28px)",
                fontWeight: 800,
                color: "#0d2137",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(13,33,55,0.65)",
                fontWeight: 600,
                letterSpacing: "0.5px",
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <section
        ref={ref}
        style={{ padding: "72px clamp(20px,5vw,40px)", background: "#fff" }}
      >
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div
            style={{
              fontSize: 12,
              color: "#2563a8",
              fontWeight: 700,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            By the numbers
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,5vw,36px)",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
              marginBottom: 12,
            }}
          >
            Growing every day
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#64748b",
              lineHeight: 1.65,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            Real numbers from real investors earning real returns on Nigeria's roads.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 24,
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
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
                padding: "32px 22px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                borderTop: "3px solid #f59e0b",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{c.icon}</div>
              <div
                style={{
                  fontSize: "clamp(28px,7vw,40px)",
                  fontWeight: 800,
                  color: "#fff",
                  overflowWrap: "anywhere",
                }}
              >
                {c.value}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#93c5fd",
                  marginTop: 6,
                  fontWeight: 500,
                  letterSpacing: "0.5px",
                }}
              >
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
''',

    "components/InvestmentCards.tsx": r'''const vehicles = [
  {
    name: "Keke Napep — Starter",
    weeklyRate: "0.48% / wk",
    minInvestment: "₦100,000 min. investment",
    soldPct: 12,
    sub: "25% annual ROI · Monthly payouts · Fully managed",
    bg: "linear-gradient(135deg,#0d2137,#1a3a5c)",
    live: true,
  },
  {
    name: "Keke Napep — Growth",
    weeklyRate: "0.48% / wk",
    minInvestment: "₦200,000 min. investment",
    soldPct: 7,
    sub: "Full keke co-ownership · Weekly or monthly payouts",
    bg: "linear-gradient(135deg,#0f2e52,#1a4a7c)",
    live: true,
  },
  {
    name: "Mini Bus",
    weeklyRate: null,
    minInvestment: "₦500,000+",
    soldPct: 0,
    sub: "Launching soon — early investors get priority access",
    bg: "linear-gradient(135deg,#1a1a2e,#252538)",
    live: false,
  },
  {
    name: "Motorcycle",
    weeklyRate: null,
    minInvestment: "₦250,000+",
    soldPct: 0,
    sub: "Launching soon — register your interest today",
    bg: "linear-gradient(135deg,#1a1520,#26202e)",
    live: false,
  },
];

const icons: Record<string, string> = {
  "Keke Napep — Starter": "🛺",
  "Keke Napep — Growth": "🛺",
  "Mini Bus": "🚌",
  Motorcycle: "🏍️",
};

export default function InvestmentCards() {
  return (
    <section id="invest" style={{ padding: "52px 20px", background: "#f8faff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 10,
              color: "#1d4ed8",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 7,
            }}
          >
            Invest now
          </div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,32px)",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            Choose a vehicle to invest in
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.65,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            Pick a keke, fund your stake, and start earning. Buses and motorcycles
            coming soon.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 680,
            margin: "0 auto",
          }}
        >
          {vehicles.map((v) => (
            <div
              key={v.name}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 2px 16px rgba(13,33,55,.07)",
                opacity: v.live ? 1 : 0.72,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "clamp(180px,42vw,200px)",
                  background: v.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "clamp(60px,15vw,80px)",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {icons[v.name]}
                </span>

                {v.live && v.weeklyRate && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#f59e0b",
                      color: "#0d2137",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "5px 12px",
                      borderRadius: 100,
                      letterSpacing: 0.3,
                    }}
                  >
                    {v.weeklyRate}
                  </div>
                )}

                {!v.live && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "rgba(13,33,55,.85)",
                      color: "#fbbf24",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 12px",
                      borderRadius: 100,
                      border: "1px solid rgba(251,191,36,.3)",
                    }}
                  >
                    Coming soon
                  </div>
                )}
              </div>

              <div style={{ padding: "18px 20px 22px" }}>
                <div
                  style={{
                    fontSize: "clamp(18px,4vw,20px)",
                    fontWeight: 700,
                    color: v.live ? "#0f172a" : "#64748b",
                    marginBottom: 10,
                  }}
                >
                  {v.name}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#64748b" }}>{v.minInvestment}</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{v.soldPct}% sold</span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: 6,
                    background: "#e2e8f0",
                    borderRadius: 100,
                    marginBottom: 16,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${v.soldPct}%`,
                      background: "#f59e0b",
                      borderRadius: 100,
                    }}
                  />
                </div>

                <button
                  disabled={!v.live}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: v.live ? "pointer" : "not-allowed",
                    border: "none",
                    fontFamily: "inherit",
                    background: v.live ? "#f59e0b" : "#f1f5f9",
                    color: v.live ? "#0d2137" : "#94a3b8",
                  }}
                >
                  {v.live ? "Invest now" : "Not yet available"}
                </button>

                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    textAlign: "center",
                    marginTop: 10,
                    lineHeight: 1.6,
                  }}
                >
                  {v.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
''',

    "components/VehicleLineup.tsx": r'''const vehicles = [
  {
    name: "🛺 Keke Napep",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Keke_Napep_in_Ibadan.jpg/1280px-Keke_Napep_in_Ibadan.jpg",
    status: "live",
    label: "Live now",
  },
  {
    name: "🚌 Mini Buses",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Lagos_danfo.jpg/1280px-Lagos_danfo.jpg",
    status: "soon",
    label: "Coming soon",
  },
  {
    name: "🏍️ Motorcycles",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Okada_riders_in_Lagos.jpg/1280px-Okada_riders_in_Lagos.jpg",
    status: "soon",
    label: "Coming soon",
  },
];

export default function VehicleLineup() {
  return (
    <section style={{ padding: "72px clamp(20px,5vw,40px)", background: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          style={{
            fontSize: 12,
            color: "#2563a8",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Our fleet
        </div>
        <h2
          style={{
            fontSize: "clamp(28px,5vw,36px)",
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          What you're investing in
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#64748b",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          Real vehicles on real Nigerian roads, generating real income for investors.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 24,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {vehicles.map((v) => (
          <div
            key={v.name}
            style={{
              borderRadius: 18,
              overflow: "hidden",
              position: "relative",
              cursor: "pointer",
            }}
          >
            <img
              src={v.img}
              alt={v.name}
              style={{
                width: "100%",
                height: "clamp(220px,44vw,260px)",
                objectFit: "cover",
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top,rgba(13,33,55,0.92) 0%,rgba(13,33,55,0.2) 60%,transparent 100%)",
              }}
            />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 }}>
              <div
                style={{
                  fontSize: "clamp(17px,4vw,18px)",
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 6,
                }}
              >
                {v.name}
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 100,
                  background:
                    v.status === "live"
                      ? "rgba(22,163,74,0.25)"
                      : "rgba(245,158,11,0.15)",
                  color: v.status === "live" ? "#86efac" : "#fbbf24",
                  border:
                    v.status === "live"
                      ? "1px solid rgba(134,239,172,0.3)"
                      : "1px solid rgba(245,158,11,0.3)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: v.status === "live" ? "#4ade80" : "#f59e0b",
                    animation: v.status === "live" ? "pulse 1.5s infinite" : "none",
                  }}
                />
                {v.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}`}</style>
    </section>
  );
}
''',

    "components/Sections.tsx": r'''const steps = [
  {
    icon: "👤",
    title: "Create account",
    desc: "Sign up in minutes. Verify identity and link your bank securely.",
  },
  {
    icon: "💳",
    title: "Pick a plan",
    desc: "Choose from ₦100k starter up to full fleet. Fund via bank transfer.",
  },
  {
    icon: "🛺",
    title: "We deploy",
    desc: "We assign vetted drivers, handle maintenance and daily operations.",
  },
  {
    icon: "💸",
    title: "You earn",
    desc: "Payouts land in your bank monthly. Track live on your dashboard.",
  },
];

const whys = [
  {
    icon: "🔐",
    title: "Asset-backed security",
    desc: "Your investment is tied to a real, physical keke — not promises.",
  },
  {
    icon: "📊",
    title: "Live earnings dashboard",
    desc: "Track your keke's trips, revenue, and payouts in real time.",
  },
  {
    icon: "🧑‍🔧",
    title: "Fully managed operations",
    desc: "Driver vetting, maintenance, fuel, and insurance — all handled.",
  },
  {
    icon: "💸",
    title: "Consistent payouts",
    desc: "Scheduled payments directly to your bank. No delays, no excuses.",
  },
  {
    icon: "📍",
    title: "Local roots",
    desc: "Based in Anambra. We deeply understand Nigerian roads and the keke economy.",
  },
  {
    icon: "🚀",
    title: "Expanding fleet",
    desc: "Start with keke. Buses and motorcycles coming — early investors get priority.",
  },
];

export function HowItWorks() {
  return (
    <section id="hiw" style={{ padding: "72px clamp(20px,5vw,40px)", background: "#0d2137" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          style={{
            fontSize: 12,
            color: "#fbbf24",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          How it works
        </div>
        <h2
          style={{
            fontSize: "clamp(28px,5vw,36px)",
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          Simple as 1, 2, 3, 4
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#93c5fd",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          No keke driving required. We handle everything on the ground so you just earn.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {steps.map((s, i) => (
          <div key={i} style={{ textAlign: "center", padding: "20px 16px" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(245,158,11,0.1)",
                border: "1.5px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 26,
              }}
            >
              {s.icon}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
              {s.title}
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WhyRidvest() {
  return (
    <section style={{ padding: "72px clamp(20px,5vw,40px)", background: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          style={{
            fontSize: 12,
            color: "#2563a8",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Why choose us
        </div>
        <h2
          style={{
            fontSize: "clamp(28px,5vw,36px)",
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          Built for Nigerian investors
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#64748b",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          Fintech meets transport to protect and grow your money.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {whys.map((w) => (
          <div
            key={w.title}
            style={{
              padding: "24px clamp(18px,3vw,28px)",
              border: "0.5px solid #e2e8f0",
              borderRadius: 16,
              transition: "all 0.3s",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#f0f6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                marginBottom: 16,
              }}
            >
              {w.icon}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              {w.title}
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{w.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
''',

    "components/Calculator.tsx": r'''\"use client\";

import { useEffect, useState } from "react";

async function fetchRate(): Promise<number> {
  try {
    const res = await fetch("/api/interest-rate");
    const data = await res.json();
    return data.rate ?? 0.25;
  } catch {
    return 0.25;
  }
}

function fmt(n: number) {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

export default function Calculator() {
  const [rate, setRate] = useState(0.25);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    fetchRate().then(setRate);
  }, []);

  const amt = parseFloat(amount) || 0;
  const yearly = amt * rate;
  const monthly = yearly / 12;
  const hasValue = amt > 0;

  return (
    <section id="calc" style={{ background: "#f8faff", padding: "64px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 11,
              color: "#1d4ed8",
              fontWeight: 700,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Returns calculator
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,34px)",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            See what you'll earn
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "#64748b",
              lineHeight: 1.65,
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            Enter your investment amount and see your projected returns instantly.
          </p>
        </div>

        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 20,
            padding: "clamp(22px,4vw,40px)",
            border: "1px solid #e2e8f0",
            boxShadow: "0 6px 32px rgba(13,33,55,0.06)",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#64748b",
                marginBottom: 8,
                display: "block",
              }}
            >
              Investment amount (₦)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 200000"
              min={100000}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                fontSize: "clamp(16px,4vw,18px)",
                fontWeight: 700,
                color: "#0d2137",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              background: "#f0f6ff",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#dcfce7",
                  color: "#15803d",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 100,
                  fontWeight: 700,
                }}
              >
                ● LIVE
              </span>
              Current annual interest rate
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1d4ed8" }}>
              {(rate * 100).toFixed(0)}% per annum
            </div>
          </div>

          {hasValue ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: 16,
              }}
            >
              {[
                { label: "Monthly profit", value: fmt(monthly), accent: true },
                { label: "Yearly profit", value: fmt(yearly) },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    background: "#0d2137",
                    borderRadius: 14,
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: 8,
                    }}
                  >
                    {r.label}
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(20px,3vw,28px)",
                      fontWeight: 800,
                      color: r.accent ? "#f59e0b" : "#fff",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {r.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                color: "#94a3b8",
                fontSize: 14,
              }}
            >
              Enter an amount above to see your returns
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
''',

    "components/Footer.tsx": r'''export function CTABanner() {
  return (
    <>
      <section
        className="ridvest-cta"
        style={{
          padding: "80px clamp(20px,5vw,40px)",
          background: "linear-gradient(135deg,#0d2137,#1a3a5c)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(30px,6vw,40px)",
              fontWeight: 800,
              color: "#fff",
              marginBottom: 14,
              letterSpacing: -0.5,
            }}
          >
            Your keke is waiting.
          </h2>
          <p
            style={{
              fontSize: "clamp(15px,2.8vw,17px)",
              color: "#93c5fd",
              marginBottom: 36,
              lineHeight: 1.7,
            }}
          >
            Join early investors earning from Nigeria's busiest transport sector.
            <br />
            Start with as little as ₦100,000 today.
          </p>
          <div
            className="ridvest-cta__actions"
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              style={{
                background: "#f59e0b",
                color: "#0d2137",
                border: "none",
                padding: "15px 32px",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Create free account →
            </button>
            <button
              style={{
                background: "transparent",
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.25)",
                padding: "15px 28px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Talk to us first
            </button>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 560px) {
          .ridvest-cta__actions {
            flex-direction: column;
          }

          .ridvest-cta__actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}

export function Footer() {
  return (
    <>
      <footer
        className="ridvest-footer"
        style={{
          background: "#060f1a",
          padding: "36px clamp(20px,5vw,40px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
            Rid<span style={{ color: "#f59e0b" }}>vest</span>
          </span>
          <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
            Invest. Ride. Earn.
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>
          © 2025 Ridvest Ltd. Ogidi, Anambra State, Nigeria.
        </p>
        <div
          className="ridvest-footer__links"
          style={{ display: "flex", gap: 20, flexWrap: "wrap" }}
        >
          {["Privacy", "Terms", "FAQ", "Contact"].map((l) => (
            <a
              key={l}
              href="#"
              style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}
            >
              {l}
            </a>
          ))}
        </div>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .ridvest-footer {
            flex-direction: column;
            text-align: center;
          }

          .ridvest-footer__links {
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
''',

    "components/Plans.tsx": r'''const plans = [
  {
    name: "STARTER",
    amount: "₦100,000",
    sub: "Minimum investment",
    roi: "20–22% ROI/yr",
    features: [
      "Partial keke ownership stake",
      "Monthly payout to your bank",
      "Online dashboard access",
      "Verified driver management",
    ],
    featured: false,
    cta: "Invest now →",
  },
  {
    name: "GROWTH",
    amount: "₦200,000",
    sub: "Co-own one full keke",
    roi: "25–28% ROI/yr",
    features: [
      "Full keke co-ownership",
      "Weekly or monthly payout",
      "Priority customer support",
      "Maintenance fully covered",
      "Real-time earnings tracker",
    ],
    featured: true,
    cta: "Invest now →",
  },
  {
    name: "FLEET",
    amount: "₦500,000+",
    sub: "Own multiple kekes",
    roi: "30–35% ROI/yr",
    features: [
      "Multi-keke ownership",
      "Flexible payout schedule",
      "Dedicated account manager",
      "Early access to new routes",
      "Priority bus/moto slots",
    ],
    featured: false,
    cta: "Talk to us →",
  },
];

export default function Plans() {
  return (
    <section id="plans" style={{ padding: "72px clamp(20px,5vw,40px)", background: "#f0f6ff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          style={{
            fontSize: 12,
            color: "#2563a8",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Investment plans
        </div>
        <h2
          style={{
            fontSize: "clamp(28px,5vw,36px)",
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          Choose your stake
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#64748b",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          All plans include full asset management, verified drivers, and monthly
          payouts.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 24,
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: plan.featured ? "#0d2137" : "#fff",
              border: plan.featured ? "2px solid #2563a8" : "0.5px solid #e2e8f0",
              borderRadius: 18,
              padding: "32px 24px",
              position: "relative",
              transition: "all 0.3s",
              cursor: "pointer",
            }}
          >
            {plan.featured && (
              <div
                style={{
                  position: "absolute",
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#2563a8",
                  color: "#fff",
                  fontSize: 11,
                  padding: "5px 16px",
                  borderRadius: 100,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.5px",
                }}
              >
                ⭐ Most popular
              </div>
            )}

            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: plan.featured ? "#93c5fd" : "#64748b",
                marginBottom: 8,
                letterSpacing: "0.5px",
              }}
            >
              {plan.name}
            </div>
            <div
              style={{
                fontSize: "clamp(28px,6vw,32px)",
                fontWeight: 800,
                color: plan.featured ? "#fff" : "#0d2137",
                marginBottom: 4,
                letterSpacing: -0.5,
              }}
            >
              {plan.amount}
            </div>
            <div
              style={{
                fontSize: 13,
                color: plan.featured ? "#93c5fd" : "#64748b",
                marginBottom: 12,
              }}
            >
              {plan.sub}
            </div>

            <div style={{ marginBottom: 24 }}>
              <span
                style={{
                  background: plan.featured ? "rgba(255,255,255,0.12)" : "#dcfce7",
                  color: plan.featured ? "#86efac" : "#15803d",
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ↑ {plan.roi}
              </span>
            </div>

            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 28,
                padding: 0,
              }}
            >
              {plan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: 13,
                    color: plan.featured ? "#bfdbfe" : "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      background: plan.featured ? "rgba(255,255,255,0.12)" : "#eff6ff",
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: plan.featured ? "#bfdbfe" : "#2563a8",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={{
                width: "100%",
                padding: 13,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: plan.featured ? "#f59e0b" : "#0d2137",
                color: plan.featured ? "#0d2137" : "#fff",
                transition: "all 0.2s",
              }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
''',

    "components/HowItWorks.tsx": r'''const steps = [
  { n: "01", title: "Create account", desc: "Sign up in minutes. Verify identity and link your bank." },
  { n: "02", title: "Choose vehicle", desc: "Pick a keke. Fund from ₦100k via bank transfer." },
  { n: "03", title: "We deploy", desc: "Vetted drivers assigned. Maintenance fully handled." },
  { n: "04", title: "You earn", desc: "Monthly payouts to your bank. Track everything live." },
];

export default function HowItWorks() {
  return (
    <section id="hiw" style={{ background: "#0d2137", padding: "52px 20px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              fontSize: 10,
              color: "#fbbf24",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 7,
            }}
          >
            How it works
          </div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,32px)",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            Simple as 1, 2, 3, 4
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#93c5fd",
              lineHeight: 1.65,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            No keke driving required. We handle everything so you just earn.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 16,
          }}
        >
          {steps.map((s) => (
            <div key={s.n} style={{ textAlign: "center", padding: "16px 12px" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "rgba(245,158,11,.08)",
                  border: "1.5px solid rgba(245,158,11,.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#f59e0b",
                }}
              >
                {s.n}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
''',

    "components/StatsStrip.tsx": r'''const stats = [
  { val: "₦48.5M", label: "Total invested" },
  { val: "312", label: "Investors" },
  { val: "87", label: "Kekes deployed" },
  { val: "₦9.2M", label: "Payouts made" },
];

export default function StatsStrip() {
  return (
    <div
      style={{
        background: "#f59e0b",
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-around",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {stats.map((s) => (
        <div key={s.label} style={{ textAlign: "center", minWidth: 80 }}>
          <div
            style={{
              fontSize: "clamp(16px,3.5vw,22px)",
              fontWeight: 800,
              color: "#0d2137",
            }}
          >
            {s.val}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(13,33,55,.6)",
              fontWeight: 600,
              letterSpacing: 0.4,
              marginTop: 1,
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
''',

    "components/WhyRidvest.tsx": r'''const items = [
  { icon: "🔒", title: "Asset-backed security", desc: "Your money is tied to a real, physical keke — not promises." },
  { icon: "📊", title: "Live earnings dashboard", desc: "Track trips, revenue, and payouts in real time from any device." },
  { icon: "🔧", title: "Fully managed operations", desc: "Driver vetting, maintenance, fuel, insurance — all on us." },
  { icon: "💳", title: "Consistent payouts", desc: "Scheduled payments directly to your bank. No delays, no excuses." },
  { icon: "📍", title: "Local roots", desc: "Based in Anambra. We know Nigerian roads and the keke economy." },
  { icon: "🚀", title: "Expanding fleet", desc: "Keke is live. Buses and motorcycles coming — early investors first." },
];

export default function WhyRidvest() {
  return (
    <section style={{ padding: "52px 20px", background: "#fff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: 10,
              color: "#1d4ed8",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 7,
            }}
          >
            Why choose us
          </div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,32px)",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            Built for Nigerian investors
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.65,
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            Fintech meets transport to protect and grow your money.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {items.map((item) => (
            <div key={item.title} style={{ padding: 22, border: "1px solid #e2e8f0", borderRadius: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "#f0f6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  marginBottom: 12,
                }}
              >
                {item.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 5 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
''',
}

for relative_path, content in files.items():
    Path(relative_path).write_text(content, encoding="utf-8")

print(f"Updated {len(files)} component files.")
