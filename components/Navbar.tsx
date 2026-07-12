"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setMenuOpen(false);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About us", href: "/about" },
    { label: "How it works", href: "/how-it-works" },
  
    { label: "Calculator", href: "/#calc" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("#")[0]) && href.split("#")[0] !== "/";
  };

  return (
    <>
      <nav
        className={`sticky top-0 z-50 w-full transition-all duration-300 border-b border-white/8 ${
          scrolled ? "bg-[#0d2137]/98 backdrop-blur-md shadow-lg shadow-black/20" : "bg-[#0d2137]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none shrink-0"
            aria-label="Rydvest Home"
          >
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
              Ryd<span className="text-amber-400">vest</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  isActive(link.href)
                    ? "text-amber-400 bg-amber-400/8"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
                {/* Active underline dot */}
                {isActive(link.href) && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400 transition-all duration-150"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#0d2137] font-bold text-sm px-5 py-2 rounded-lg transition-all duration-150 shadow-lg shadow-amber-400/20"
            >
              Get started →
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>

        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#0d2137] border-b border-white/8 shadow-xl shadow-black/30">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive(link.href)
                    ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive(link.href) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                )}
                {link.label}
              </Link>
            ))}

            <div className="border-t border-white/8 mt-3 pt-4 flex flex-col gap-3">
              <Link
                href="/login"
                onClick={close}
                className="w-full text-center text-sm font-semibold px-4 py-3 rounded-xl border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 transition-all"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={close}
                className="w-full text-center bg-amber-400 hover:bg-amber-300 text-[#0d2137] font-bold text-sm px-4 py-3 rounded-xl transition-all"
              >
                Get started →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
