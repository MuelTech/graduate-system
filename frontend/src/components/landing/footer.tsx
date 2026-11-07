import Link from "next/link";
import { GraduationCap } from "lucide-react";

const quickLinks = [
  { href: "/programs", label: "Programs" },
  { href: "/repository", label: "Repository" },
  { href: "/faq", label: "FAQ" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

export function Footer() {
  return (
    <footer className="bg-(--earist-primary) text-white">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {/* Institutional identity */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap
                aria-hidden="true"
                className="h-7 w-7 shrink-0 text-(--earist-accent)"
              />
              <span className="text-lg font-bold">EARIST Graduate School</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/90">
              Eulogio &ldquo;Amang&rdquo; Rodriguez Institute of Science and
              Technology
            </p>
          </div>

          {/* Verified destinations */}
          <nav aria-label="Footer navigation">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-white uppercase">
              Quick Links
            </h2>
            <ul>
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-md text-sm text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-white/20 pt-6">
          <p className="text-xs text-white/90">
            © {new Date().getFullYear()} EARIST Graduate School Information
            System. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
