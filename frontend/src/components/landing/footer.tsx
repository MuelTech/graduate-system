import Image from "next/image";
import Link from "next/link";
import { publicSiteContent } from "@/content/public-site-content";

const footerGroups = [
  {
    id: "study",
    title: "Explore the Graduate School",
    links: [
      { label: "Home", href: "/" },
      { label: "News & Announcements", href: "/#news" },
      { label: "About", href: "/#about" },
      { label: "Programs", href: "/#programs" },
    ],
  },
  {
    id: "research",
    title: "Research & Contact",
    links: [
      { label: "Research", href: "/repository" },
      { label: "Contact Us", href: "/#contact" },
    ],
  },
  {
    id: "contact",
    title: "Official platforms",
    links: [
      {
        label: "EARIST Website",
        href: publicSiteContent.contact.platforms[0].href,
      },
      {
        label: "Apply through Pinnacle ↗",
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
                      Create Account
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
