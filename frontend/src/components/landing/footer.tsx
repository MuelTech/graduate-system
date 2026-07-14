import Link from "next/link";
import {
  GraduationCap,
  Mail,
  Phone,
  MapPin,
  Globe,
  ExternalLink,
} from "lucide-react";

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
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Left Column — Contact Information */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-(--earist-accent)" />
              <span className="text-lg font-bold">EARIST Graduate School</span>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-accent)" />
                <span className="text-sm text-white/80">
                  Eulogio &ldquo;Amang&rdquo; Rodriguez Institute of Science and
                  Technology, Manila, Philippines
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-(--earist-accent)" />
                <span className="text-sm text-white/80">gs@earist.edu.ph</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-(--earist-accent)" />
                <span className="text-sm text-white/80">(02) 8534-8267</span>
              </li>
            </ul>
          </div>

          {/* Center Column — Quick Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider text-(--earist-accent) uppercase">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column — Social Media + Mission */}
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wider text-(--earist-accent) uppercase">
              Connect With Us
            </h3>
            <div className="mb-4 flex gap-3">
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-(--earist-accent) hover:text-(--earist-primary)"
              >
                <Globe className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Website"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-(--earist-accent) hover:text-(--earist-primary)"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="text-sm text-white/70">
              Committed to excellence in graduate education, research, and
              community service — producing competent professionals and scholars
              for national development.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-white/20 pt-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-xs text-white/50">
              © {new Date().getFullYear()} EARIST Graduate School Information
              System. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                Terms of Use
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
