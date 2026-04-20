const vehicles = [
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
  "Motorcycle": "🏍️",
};

export default function InvestmentCards() {
  return (
    <section id="invest" style={{ padding: "52px 20px", background: "#f8faff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>Invest now</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 8 }}>Choose a vehicle to invest in</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>Pick a keke, fund your stake, and start earning. Buses and motorcycles coming soon.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640, margin: "0 auto" }}>
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
              {/* Image area */}
              <div style={{ position: "relative", width: "100%", height: 200, background: v.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 80, userSelect: "none", pointerEvents: "none" }}>{icons[v.name]}</span>

                {v.live && v.weeklyRate && (
                  <div style={{ position: "absolute", top: 12, right: 12, background: "#f59e0b", color: "#0d2137", fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 100, letterSpacing: 0.3 }}>
                    {v.weeklyRate}
                  </div>
                )}

                {!v.live && (
                  <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(13,33,55,.85)", color: "#fbbf24", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 100, border: "1px solid rgba(251,191,36,.3)" }}>
                    Coming soon
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: "18px 20px 22px" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: v.live ? "#0f172a" : "#64748b", marginBottom: 10 }}>{v.name}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, color: "#64748b" }}>{v.minInvestment}</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{v.soldPct}% sold</span>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 100, marginBottom: 16, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v.soldPct}%`, background: "#f59e0b", borderRadius: 100 }} />
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

                <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 10 }}>{v.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
