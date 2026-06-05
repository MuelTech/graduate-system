"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, GraduationCap } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/repository", label: "Research Repository" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[var(--earist-border-gray)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-[var(--earist-primary)]" />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[var(--earist-primary)] leading-tight">
              EARIST
            </span>
            <span className="text-xs text-[var(--earist-secondary)] leading-tight">
              Graduate School
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--earist-body-text)] transition-colors hover:text-[var(--earist-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex md:items-center md:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg border-2 border-[var(--earist-primary)] px-5 text-sm font-semibold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-primary)] hover:text-white"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--earist-accent)] px-5 text-sm font-semibold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-accent)]/90"
          >
            Register
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <X className="h-6 w-6 text-[var(--earist-primary)]" />
          ) : (
            <Menu className="h-6 w-6 text-[var(--earist-primary)]" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="border-t border-[var(--earist-border-gray)] bg-white md:hidden">
          <div className="container mx-auto space-y-1 px-4 pb-4 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--earist-body-text)] transition-colors hover:bg-[var(--earist-surface-light-red)] hover:text-[var(--earist-primary)]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-lg border-2 border-[var(--earist-primary)] px-5 text-sm font-semibold text-[var(--earist-primary)]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--earist-accent)] px-5 text-sm font-semibold text-[var(--earist-primary)]"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
