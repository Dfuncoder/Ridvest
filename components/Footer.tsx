export function CTABanner() {
  return (
    <section style={{ padding: "80px 40px", background: "linear-gradient(135deg,#0d2137,#1a3a5c)", textAlign: "center" }}>
      <h2 style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginBottom: 14, letterSpacing: -0.5 }}>Your keke is waiting.</h2>
      <p style={{ fontSize: 17, color: "#93c5fd", marginBottom: 36, lineHeight: 1.7 }}>
        Join early investors earning from Nigeria's busiest transport sector.<br />
        Start with as little as ₦100,000 today.
      </p>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          style={{ background: "#f59e0b", color: "#0d2137", border: "none", padding: "15px 32px", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer" }}
        >
          Create free account →
        </button>
        <button
          style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.25)", padding: "15px 28px", borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: "pointer" }}
        >
          Talk to us first
        </button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ background: "#060f1a", padding: "36px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
          Rid<span style={{ color: "#f59e0b" }}>vest</span>
        </span>
        <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>Invest. Ride. Earn.</div>
      </div>
      <p style={{ fontSize: 12, color: "#334155" }}>© 2025 Ridvest Ltd. Ogidi, Anambra State, Nigeria.</p>
      <div style={{ display: "flex", gap: 20 }}>
        {["Privacy", "Terms", "FAQ", "Contact"].map((l) => (
          <a key={l} href="#" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>{l}</a>
        ))}
      </div>
    </footer>
  );
}
