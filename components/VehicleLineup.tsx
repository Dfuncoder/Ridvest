const vehicles = [
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
    <section style={{ padding: "72px 40px", background: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontSize: 12, color: "#2563a8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>Our fleet</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 12 }}>What you're investing in</h2>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>Real vehicles on real Nigerian roads, generating real income for investors.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
        {vehicles.map((v) => (
          <div
            key={v.name}
            style={{ borderRadius: 18, overflow: "hidden", position: "relative", cursor: "pointer" }}
          >
            <img
              src={v.img}
              alt={v.name}
              style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(13,33,55,0.92) 0%,rgba(13,33,55,0.2) 60%,transparent 100%)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{v.name}</div>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 100,
                background: v.status === "live" ? "rgba(22,163,74,0.25)" : "rgba(245,158,11,0.15)",
                color: v.status === "live" ? "#86efac" : "#fbbf24",
                border: v.status === "live" ? "1px solid rgba(134,239,172,0.3)" : "1px solid rgba(245,158,11,0.3)",
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: v.status === "live" ? "#4ade80" : "#f59e0b",
                  animation: v.status === "live" ? "pulse 1.5s infinite" : "none",
                }} />
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
