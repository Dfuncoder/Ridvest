"use client";

export default function Navbar() {
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 58, background: "#0d2137",
      position: "sticky", top: 0, zIndex: 100,
      borderBottom: "1px solid rgba(255,255,255,0.07)",
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
        Rid<span style={{ color: "#f59e0b" }}>vest</span>
      </span>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <button onClick={() => go("invest")} style={{ fontSize: 13, color: "rgba(255,255,255,.6)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Invest</button>
        <button onClick={() => go("calc")} style={{ fontSize: 13, color: "rgba(255,255,255,.6)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Calculator</button>
        <button onClick={() => go("invest")} style={{ background: "#f59e0b", color: "#0d2137", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Get started</button>
      </div>
    </nav>
  );
}
