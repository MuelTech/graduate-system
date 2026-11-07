"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
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
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setIsOpen(false);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
      menuButtonRef.current?.focus();
    }
  }

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 w-full border-b border-(--earist-border-gray) bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          onClick={closeMenu}
          className="flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <GraduationCap
            aria-hidden="true"
            className="h-8 w-8 text-(--earist-primary)"
          />
          <div className="flex flex-col">
            <span className="text-lg leading-tight font-bold text-(--earist-primary)">
              EARIST
            </span>
            <span className="text-xs leading-tight text-(--earist-secondary)">
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
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-(--earist-body-text) transition-colors hover:text-(--earist-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex md:items-center md:gap-3">
          <Link
            href="/login"
            onClick={closeMenu}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-(--earist-primary) px-5 text-sm font-semibold text-(--earist-primary) transition-colors hover:bg-(--earist-primary) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Login
          </Link>
          <Link
            href="/register"
            onClick={closeMenu}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-(--earist-accent) px-5 text-sm font-semibold text-(--earist-primary) transition-colors hover:bg-(--earist-accent)/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Register
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          ref={menuButtonRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleMenuKeyDown}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls={menuId}
        >
          {isOpen ? (
            <X aria-hidden="true" className="h-6 w-6 text-(--earist-primary)" />
          ) : (
            <Menu
              aria-hidden="true"
              className="h-6 w-6 text-(--earist-primary)"
            />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        id={menuId}
        hidden={!isOpen}
        onKeyDown={handleMenuKeyDown}
        className="border-t border-(--earist-border-gray) bg-white md:hidden"
      >
        <div className="container mx-auto space-y-1 px-4 pt-2 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-light-red) hover:text-(--earist-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/login"
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-(--earist-primary) px-5 text-sm font-semibold text-(--earist-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-(--earist-accent) px-5 text-sm font-semibold text-(--earist-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
