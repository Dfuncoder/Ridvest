"use client";

import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 transition-colors duration-300 border-b border-white/10 backdrop-blur-md ${
        scrolled ? "bg-[#0d2137]/95" : "bg-[#0d2137]/90"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
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
        <span className="text-white font-extrabold text-xl tracking-tight">
          Rid<span className="text-yellow-500">vest</span>
        </span>
      </div>

      {/* Mobile Toggle */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden text-white text-2xl focus:outline-none"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      {/* Links */}
      <div
        className={`flex-1 flex justify-end items-center gap-8 ${
          menuOpen
            ? "fixed top-16 left-0 right-0 flex-col bg-[#0d2137] p-8 gap-6 border-b border-white/10"
            : "hidden md:flex"
        }`}
      >
        {[
          { label: "About Us", id: "about" },
          { label: "How it works", id: "hiw" },
          { label: "Calculator", id: "calc" },
        ].map((link) => (
          <button
            key={link.id}
            onClick={() => scrollTo(link.id)}
            className="text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            {link.label}
          </button>
        ))}

        {/* Login Button */}
        <button
          onClick={() => scrollTo("login")}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-[#0d2137] transition-colors"
        >
          Login
        </button>

        {/* Get Started Button */}
        <button
          className="bg-yellow-500 text-[#0d2137] font-bold text-sm px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Get started →
        </button>
      </div>
    </nav>
  );
}
