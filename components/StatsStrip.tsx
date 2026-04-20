const stats = [
  { val: "₦48.5M", label: "Total invested" },
  { val: "312", label: "Investors" },
  { val: "87", label: "Kekes deployed" },
  { val: "₦9.2M", label: "Payouts made" },
];

export default function StatsStrip() {
  return (
    <div style={{ background: "#f59e0b", padding: "14px 20px", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 10 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: "clamp(16px,3.5vw,22px)", fontWeight: 800, color: "#0d2137" }}>{s.val}</div>
          <div style={{ fontSize: 10, color: "rgba(13,33,55,.6)", fontWeight: 600, letterSpacing: 0.4, marginTop: 1 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
