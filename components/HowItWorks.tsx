const steps = [
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
          <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>How it works</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 8 }}>Simple as 1, 2, 3, 4</h2>
          <p style={{ fontSize: 14, color: "#93c5fd", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>No keke driving required. We handle everything so you just earn.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ textAlign: "center", padding: "16px 12px" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(245,158,11,.08)", border: "1.5px solid rgba(245,158,11,.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 15, fontWeight: 800, color: "#f59e0b" }}>{s.n}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
