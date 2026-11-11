"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/#news", label: "News" },
  { href: "/#about", label: "About" },
  { href: "/#programs", label: "Programs" },
  { href: "/repository", label: "Research" },
  { href: "/#contact", label: "Contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { institution } = publicSiteContent;

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
    <header className="public-masthead">
      <div className="public-masthead__inner">
        <Link
          href="/"
          onClick={closeMenu}
          className="public-masthead__identity"
        >
          <Image
            src={institution.sealSrc}
            alt="EARIST seal"
            width={64}
            height={64}
            className="public-masthead__seal"
          />
          <span className="public-masthead__lockup">
            <span className="public-masthead__school">Graduate School</span>
            <span className="public-masthead__full-name">
              {institution.fullName}
            </span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="public-masthead__desktop-nav"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="public-masthead__link"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="public-masthead__desktop-account">
          <Link
            href="/login"
            onClick={closeMenu}
            className="public-masthead__signin"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={closeMenu}
            className="public-masthead__register"
          >
            Create Account
          </Link>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          className="public-masthead__menu-toggle"
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={handleMenuKeyDown}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls={menuId}
        >
          {isOpen ? (
            <X aria-hidden="true" size={24} />
          ) : (
            <Menu aria-hidden="true" size={24} />
          )}
        </button>
      </div>
      <div
        className="public-masthead__backdrop"
        data-open={isOpen ? "true" : "false"}
        aria-hidden="true"
        onClick={closeMenu}
      />
      <nav
        id={menuId}
        aria-label="Mobile navigation"
        data-open={isOpen ? "true" : "false"}
        aria-hidden={!isOpen}
        inert={!isOpen}
        onKeyDown={handleMenuKeyDown}
        className="public-masthead__panel"
      >
        <div className="public-masthead__drawer-header">
          <div className="public-masthead__drawer-brand">
            <Image
              src={institution.sealSrc}
              alt=""
              width={40}
              height={40}
              className="public-masthead__drawer-seal"
            />
            <div>
              <span className="public-masthead__drawer-eyebrow">
                Navigation Menu
              </span>
              <span className="public-masthead__drawer-title">
                Graduate School
              </span>
            </div>
          </div>
          <button
            type="button"
            className="public-masthead__drawer-close"
            onClick={() => {
              closeMenu();
              menuButtonRef.current?.focus();
            }}
            aria-label="Close mobile navigation"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="public-masthead__panel-inner">
          <div className="public-masthead__drawer-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="public-masthead__link"
              >
                <span>{link.label}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            ))}
          </div>
          <div className="public-masthead__mobile-account">
            <p className="public-masthead__mobile-caption">
              Portal Access &amp; Applicant Services
            </p>
            <Link
              href="/login"
              onClick={closeMenu}
              className="public-masthead__signin"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={closeMenu}
              className="public-masthead__register"
            >
              Create Account
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
