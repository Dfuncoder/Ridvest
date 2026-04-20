"use client";

import { useEffect, useState } from "react";

async function fetchRate(): Promise<number> {
  try {
    const res = await fetch("/api/interest-rate");
    const data = await res.json();
    return data.rate ?? 0.25;
  } catch {
    return 0.25;
  }
}

function fmt(n: number) {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

export default function Calculator() {
  const [rate, setRate] = useState(0.25);
  const [amount, setAmount] = useState("");

  useEffect(() => { fetchRate().then(setRate); }, []);

  const amt = parseFloat(amount) || 0;
  const yearly = amt * rate;
  const monthly = yearly / 12;
  const hasValue = amt > 0;

  return (
    <section id="calc" style={{ background: "#f8faff", padding: "64px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>Returns calculator</div>
          <h2 style={{ fontSize: "clamp(26px,4vw,34px)", fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 10 }}>See what you'll earn</h2>
          <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.65, maxWidth: 460, margin: "0 auto" }}>Enter your investment amount and see your projected returns instantly.</p>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto", background: "#fff", borderRadius: 20, padding: "clamp(24px,4vw,40px)", border: "1px solid #e2e8f0", boxShadow: "0 6px 32px rgba(13,33,55,0.06)" }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Investment amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 200000"
              min={100000}
              style={{ width: "100%", padding: "14px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 18, fontWeight: 700, color: "#0d2137", fontFamily: "inherit", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0f6ff", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#dcfce7", color: "#15803d", fontSize: 10, padding: "3px 8px", borderRadius: 100, fontWeight: 700 }}>● LIVE</span>
              Current annual interest rate
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1d4ed8" }}>{(rate * 100).toFixed(0)}% per annum</div>
          </div>

          {hasValue ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { label: "Monthly profit", value: fmt(monthly), accent: true },
                { label: "Yearly profit", value: fmt(yearly) },
              ].map((r) => (
                <div key={r.label} style={{ background: "#0d2137", borderRadius: 14, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{r.label}</div>
                  <div style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, color: r.accent ? "#f59e0b" : "#fff" }}>{r.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 14 }}>
              Enter an amount above to see your returns
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
