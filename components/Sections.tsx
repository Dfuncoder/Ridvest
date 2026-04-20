const steps = [
  { icon: "👤", title: "Create account", desc: "Sign up in minutes. Verify identity and link your bank securely." },
  { icon: "💳", title: "Pick a plan", desc: "Choose from ₦100k starter up to full fleet. Fund via bank transfer." },
  { icon: "🛺", title: "We deploy", desc: "We assign vetted drivers, handle maintenance and daily operations." },
  { icon: "💸", title: "You earn", desc: "Payouts land in your bank monthly. Track live on your dashboard." },
];

const whys = [
  { icon: "🔐", title: "Asset-backed security", desc: "Your investment is tied to a real, physical keke — not promises." },
  { icon: "📊", title: "Live earnings dashboard", desc: "Track your keke's trips, revenue, and payouts in real time." },
  { icon: "🧑‍🔧", title: "Fully managed operations", desc: "Driver vetting, maintenance, fuel, and insurance — all handled." },
  { icon: "💸", title: "Consistent payouts", desc: "Scheduled payments directly to your bank. No delays, no excuses." },
  { icon: "📍", title: "Local roots", desc: "Based in Anambra. We deeply understand Nigerian roads and the keke economy." },
  { icon: "🚀", title: "Expanding fleet", desc: "Start with keke. Buses and motorcycles coming — early investors get priority." },
];

const emojiStyle = {
  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
};

export function HowItWorks() {
  return (
    <section id="hiw" style={{ padding: "clamp(40px, 8vw, 72px) 20px", background: "#0d2137" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>How it works</div>
        <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 12 }}>Simple as 1, 2, 3, 4</h2>
        <p style={{ fontSize: 16, color: "#93c5fd", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>No keke driving required. We handle everything on the ground so you just earn.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ textAlign: "center", padding: "20px 16px" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 26 }}>
              <span style={emojiStyle}>{s.icon}</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{s.title}</h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WhyRidvest() {
  return (
    <section style={{ padding: "clamp(40px, 8vw, 72px) 20px", background: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontSize: 12, color: "#2563a8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>Why choose us</div>
        <h2 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 12 }}>Built for Nigerian investors</h2>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>Fintech meets transport to protect and grow your money.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, maxWidth: 1000, margin: "0 auto" }}>
        {whys.map((w) => (
          <div key={w.title} style={{ padding: 28, border: "0.5px solid #e2e8f0", borderRadius: 16, transition: "all 0.3s" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f0f6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>
              <span style={emojiStyle}>{w.icon}</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{w.title}</h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{w.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
