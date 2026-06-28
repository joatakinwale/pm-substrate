"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo — Margo Beuys per brand guide */}
        <Link href="/" className="flex items-center gap-0.5 font-margo">
          <span className="text-2xl tracking-tight text-foreground">
            stevie
          </span>
          <span className="text-2xl tracking-tight text-stevie-green">
            social
          </span>
        </Link>

        {/* Desktop Nav — FE-40: inline-flex + h-11 gives text links a 44px
            hit target height without changing visual padding (text baseline
            stays where the design put it). */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center h-11 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
          >
            Book a call
          </Link>
        </div>

        {/* Mobile Toggle — FE-40: p-3 + 20px icon = 44px square (was p-2 =
            36px square, below the 44px touch-target target). */}
        <button
          className="md:hidden p-3 -mr-3"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu — FE-40: menu links get flex + min-h-[44px] so taps on
          whitespace around the label still register. Previously bare <Link>
          with `block text-sm` shrank the hit area to line-height only
          (~20px), painful on touch. */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border px-6 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center min-h-[44px] text-sm text-muted-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/book"
            className="block w-full text-center mt-2 px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold"
            onClick={() => setMobileOpen(false)}
          >
            Book a call
          </Link>
        </div>
      )}
    </nav>
  );
}
