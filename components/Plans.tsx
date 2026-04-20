const plans = [
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
    <section id="plans" style={{ padding: "clamp(40px, 8vw, 72px) 20px", background: "#f0f6ff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontSize: 12, color: "#2563a8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>Investment plans</div>
        <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 12 }}>Choose your stake</h2>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>All plans include full asset management, verified drivers, and monthly payouts.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: plan.featured ? "#0d2137" : "#fff",
              border: plan.featured ? "2px solid #2563a8" : "0.5px solid #e2e8f0",
              borderRadius: 18,
              padding: 32,
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

            <div style={{ fontSize: 14, fontWeight: 600, color: plan.featured ? "#93c5fd" : "#64748b", marginBottom: 8, letterSpacing: "0.5px" }}>{plan.name}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: plan.featured ? "#fff" : "#0d2137", marginBottom: 4, letterSpacing: -0.5 }}>{plan.amount}</div>
            <div style={{ fontSize: 13, color: plan.featured ? "#93c5fd" : "#64748b", marginBottom: 12 }}>{plan.sub}</div>

            <div style={{ marginBottom: 24 }}>
              <span style={{
                background: plan.featured ? "rgba(255,255,255,0.12)" : "#dcfce7",
                color: plan.featured ? "#86efac" : "#15803d",
                padding: "3px 10px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
              }}>↑ {plan.roi}</span>
            </div>

            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ fontSize: 13, color: plan.featured ? "#bfdbfe" : "#475569", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 18, height: 18, background: plan.featured ? "rgba(255,255,255,0.12)" : "#eff6ff", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: plan.featured ? "#bfdbfe" : "#2563a8", flexShrink: 0 }}>✓</span>
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
