import Image from "next/image";
import Link from "next/link";
import { publicSiteContent } from "@/content/public-site-content";

const footerGroups = [
  {
    id: "study",
    title: "Study & Information",
    links: [
      { label: "Programs", href: "/#programs" },
      { label: "Getting Started", href: "/#getting-started" },
      { label: "About", href: "/#about" },
    ],
  },
  {
    id: "research",
    title: "Research & Updates",
    links: [
      { label: "Research Repository", href: "/repository" },
      { label: "News & Announcements", href: "/#news" },
    ],
  },
  {
    id: "contact",
    title: "Contact & Access",
    links: [
      { label: "Contact Us", href: "/#contact" },
      {
        label: "EARIST Website",
        href: publicSiteContent.contact.platforms[0].href,
      },
      {
        label: "Applicant Portal",
        href: publicSiteContent.contact.platforms[1].href,
      },
    ],
  },
] as const;

export function Footer() {
  const { institution } = publicSiteContent;

  return (
    <footer className="public-footer">
      <div className="public-body-frame">
        <div className="public-footer__layout">
          <div>
            <Link href="/" className="public-footer__identity">
              <Image
                src={institution.sealSrc}
                alt="EARIST seal"
                width={56}
                height={56}
              />
              <span>
                EARIST
                <span className="public-footer__school">Graduate School</span>
              </span>
            </Link>
            <p className="public-footer__institution">{institution.fullName}</p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="public-footer__navigation"
          >
            {footerGroups.map((group) => (
              <div key={group.id}>
                <h2 className="public-footer__group-title">{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("https://") ? (
                        <a href={link.href} className="public-footer__link">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="public-footer__link">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                {group.id === "contact" && (
                  <div className="public-footer__accounts">
                    <Link href="/login" className="public-footer__link">
                      Sign In
                    </Link>
                    <Link href="/register" className="public-footer__link">
                      Register
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="public-footer__bottom">
          <p>
            © {new Date().getFullYear()} EARIST Graduate School Information
            System. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
