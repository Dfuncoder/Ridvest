"use client";

export default function Hero() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg,#060f1a 0%,#0d2137 50%,#0f2e52 100%)",
        minHeight: "92vh",
        display: "flex",
        alignItems: "center",
        padding: "clamp(80px, 12vw, 120px) 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background blobs */}
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "#2563a8", top: -100, right: -100, filter: "blur(80px)", opacity: 0.12, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "#f59e0b", bottom: -150, left: -100, filter: "blur(80px)", opacity: 0.10, pointerEvents: "none" }} />

      <div
        className="hero-grid"
        style={{
          display: "grid",
          gap: 60,
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Left: text */}
        <div>
          
            
          

          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 56px)",
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: -1,
            }}
          >
            Turn{" "}
            <span style={{ color: "#f59e0b" }}>₦100k</span>{" "}
            into a keke that earns for you
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 2vw, 17px)",
              color: "#94a3b8",
              lineHeight: 1.75,
              marginBottom: 36,
              maxWidth: 480,
            }}
          >
            Ridvest lets everyday Nigerians co-invest in tricycles and earn consistent
            monthly returns — fully managed, asset-backed, and transparent.
          </p>

          <div className="hero-btns" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
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
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              Start investing →
            </button>
            <button
              onClick={() => document.getElementById("calc")?.scrollIntoView({ behavior: "smooth" })}
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

        {/* Right: card with keke image + floating stats */}
        <div className="hero-visual" style={{ position: "relative", width: "100%" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: 28,
              backdropFilter: "blur(10px)",
            }}
          >
            <img
              src="/header_image.png"
              alt="Keke Napep"
              style={{ width: "100%", borderRadius: 14, height: 220, objectFit: "cover", display: "block" }}
            />
          </div>

          {/* Floating card 1 */}
          <div
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              background: "rgba(13,33,55,0.92)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "14px 18px",
              backdropFilter: "blur(12px)",
              animation: "float 3s ease-in-out infinite",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Monthly payout</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>₦4,167</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>↑ on ₦200k invested</div>
          </div>

          {/* Floating card 2 */}
          <div
            style={{
              position: "absolute",
              bottom: -10,
              left: -10,
              background: "rgba(13,33,55,0.92)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: "14px 18px",
              backdropFilter: "blur(12px)",
              animation: "float 3s ease-in-out infinite",
              animationDelay: "1.5s",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Annual ROI</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>25%</div>
            <div style={{ fontSize: 11, color: "#f59e0b" }}>Fixed rate · Asset-backed</div>
          </div>
        </div>
      </div>

      <style>{`
        .hero-grid {
          grid-template-columns: 1fr 1fr;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @media (max-width: 991px) {
          .hero-grid {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .hero-grid p {
            margin-left: auto;
            margin-right: auto;
          }
          .hero-btns {
            justify-content: center;
            flex-wrap: wrap;
          }
          .hero-visual {
            max-width: 500px;
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  );
}
