"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[600px] items-center justify-center overflow-hidden bg-[var(--earist-primary)]">
      {/* Background Image Placeholder with Navy Gradient Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/campus-hero.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a0a]/80 via-[var(--earist-primary)]/70 to-[var(--earist-primary)]/90" />

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 py-24 text-center sm:px-6 lg:px-8">
        {/* Headline */}
        <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Graduate School Information System
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mb-10 max-w-3xl text-lg italic text-white/80 sm:text-xl">
          Eulogio "Amang" Rodriguez Institute of Science and Technology
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--earist-accent)] px-8 text-base font-bold text-[var(--earist-primary)] shadow-lg transition-colors hover:bg-[var(--earist-accent)]/90"
          >
            Start Your Application
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-white px-8 text-base font-bold text-white transition-colors hover:bg-white/10"
          >
            Sign In
          </Link>
        </div>

        {/* Scroll Down Indicator */}
        <div className="mt-16 flex flex-col items-center">
          <span className="mb-2 text-sm text-white/60">Scroll Down</span>
          <ChevronDown className="h-6 w-6 animate-bounce text-white/60" />
        </div>
      </div>
    </section>
  );
}
