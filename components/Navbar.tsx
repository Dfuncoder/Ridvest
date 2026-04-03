"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        height: "64px",
        background: scrolled
          ? "rgba(13,33,55,0.98)"
          : "rgba(13,33,55,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        transition: "background 0.3s",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="32" height="32" viewBox="0 0 36 36">
          <rect width="36" height="36" rx="8" fill="#1a3a5c" />
          <rect x="6" y="14" width="22" height="12" rx="4" fill="#2563a8" />
          <rect x="4" y="10" width="26" height="7" rx="3" fill="#3b82f6" />
          <rect x="24" y="14" width="4" height="12" rx="2" fill="#f59e0b" />
          <circle cx="9" cy="27" r="4" fill="#0d2137" stroke="#f59e0b" strokeWidth="1.5" />
          <circle cx="9" cy="27" r="1.5" fill="#f59e0b" />
          <circle cx="27" cy="27" r="4" fill="#0d2137" stroke="#f59e0b" strokeWidth="1.5" />
          <circle cx="27" cy="27" r="1.5" fill="#f59e0b" />
          <circle cx="30" cy="11" r="5" fill="#f59e0b" />
          <text x="30" y="14" textAnchor="middle" fontSize="6" fontWeight="700" fill="#1a3a5c" fontFamily="system-ui">₦</text>
        </svg>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
          Rid<span style={{ color: "#f59e0b" }}>vest</span>
        </span>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {[
          { label: "Plans", id: "plans" },
          { label: "How it works", id: "hiw" },
          { label: "Calculator", id: "calc" },
        ].map((link) => (
          <button
            key={link.id}
            onClick={() => scrollTo(link.id)}
            style={{
              background: "none",
              border: "none",
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >
            {link.label}
          </button>
        ))}
        <button
          style={{
            background: "#f59e0b",
            color: "#0d2137",
            border: "none",
            padding: "9px 20px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fbbf24")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#f59e0b")}
        >
          Get started →
        </button>
      </div>
    </nav>
  );
}
