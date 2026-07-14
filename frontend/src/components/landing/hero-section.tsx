"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-150 items-center justify-center overflow-hidden bg-(--earist-primary)">
      {/* Background Image Placeholder with Navy Gradient Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/campus-hero.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-[#1a0a0a]/80 via-(--earist-primary)/70 to-(--earist-primary)/90" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-24 text-center sm:px-6 lg:px-8">
        {/* Headline */}
        <h1 className="mx-auto mb-6 max-w-4xl text-4xl leading-tight font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Graduate School Information System
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mb-10 max-w-3xl text-lg text-white/80 italic sm:text-xl">
          Eulogio &quot;Amang&quot; Rodriguez Institute of Science and Technology
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-(--earist-accent) px-8 text-base font-bold text-(--earist-primary) shadow-lg transition-colors hover:bg-(--earist-accent)/90"
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
