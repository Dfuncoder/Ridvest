"use client";

import { useEffect, useState } from "react";

// This fetches the interest rate from your Next.js API route.
// The API route returns dummy data (25%) for now — swap with real DB later.
async function fetchRate(): Promise<number> {
  try {
    const res = await fetch("/api/interest-rate");
    const data = await res.json();
    return data.rate ?? 0.25;
  } catch {
    return 0.25; // fallback
  }
}

function fmt(n: number) {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

export default function Calculator() {
  const [rate, setRate] = useState(0.25);
  const [amount, setAmount] = useState(200_000);
  const [months, setMonths] = useState(12);
  const [freq, setFreq] = useState(12); // payouts per year

  useEffect(() => {
    fetchRate().then(setRate);
  }, []);

  const years = months / 12;
  const interest = amount * rate * years;
  const total = amount + interest;
  const payoutsCount = Math.round(freq * years) || 1;
  const perPayout = interest / payoutsCount;

  return (
    <section id="calc" style={{ padding: "72px 40px", background: "#f0f6ff" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 12, color: "#2563a8", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 8 }}>Returns calculator</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5, marginBottom: 12 }}>See your earnings</h2>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>Adjust the sliders to calculate your expected returns.</p>
      </div>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 24,
          padding: 40,
          border: "0.5px solid #e2e8f0",
          boxShadow: "0 8px 40px rgba(13,33,55,0.07)",
        }}
      >
        {/* Sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
              <span>Investment amount</span>
              <span style={{ fontWeight: 700, color: "#0d2137" }}>₦{amount.toLocaleString("en-NG")}</span>
            </div>
            <input
              type="range"
              min={100_000}
              max={2_000_000}
              step={50_000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
              <span>₦100k</span><span>₦2M</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
              <span>Duration</span>
              <span style={{ fontWeight: 700, color: "#0d2137" }}>{months} months</span>
            </div>
            <input
              type="range"
              min={3}
              max={36}
              step={3}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
              <span>3 months</span><span>36 months</span>
            </div>
          </div>
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Payout frequency</div>
          <select
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            style={{ width: "100%", padding: "12px 14px", border: "0.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
          >
            <option value={12}>Monthly</option>
            <option value={4}>Quarterly</option>
            <option value={1}>Annually</option>
          </select>
        </div>

        {/* Results */}
        <div
          style={{
            background: "#0d2137",
            borderRadius: 16,
            padding: 28,
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 20,
          }}
        >
          {[
            { label: "Total interest earned", value: fmt(interest), accent: true },
            { label: "Total returned", value: fmt(total) },
            { label: `Per ${freq === 12 ? "monthly" : freq === 4 ? "quarterly" : "annual"} payout`, value: fmt(perPayout) },
          ].map((r) => (
            <div key={r.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>{r.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: r.accent ? "#f59e0b" : "#fff" }}>{r.value}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Live rate: {(rate * 100).toFixed(0)}% per annum (from backend)
        </div>
      </div>
    </section>
  );
}
