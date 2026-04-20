const items = [
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
          <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>Why choose us</div>
          <h2 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 8 }}>Built for Nigerian investors</h2>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>Fintech meets transport to protect and grow your money.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {items.map((item) => (
            <div key={item.title} style={{ padding: 22, border: "1px solid #e2e8f0", borderRadius: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0f6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 5 }}>{item.title}</h3>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
