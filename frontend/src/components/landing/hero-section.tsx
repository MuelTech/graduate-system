import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { AnnouncementsSection } from "./announcements-section";

export function HeroSection() {
  const { hero, news, contact } = publicSiteContent;

  return (
    <section
      id="news"
      aria-labelledby="landing-title"
      className="public-opening"
    >
      <div className="public-body-frame">
        <header className="public-opening__heading">
          <div>
            <p className="public-body-eyebrow">Welcome to EARIST</p>
            <h1 id="landing-title">EARIST Graduate School</h1>
            <p className="public-opening__description">{hero.description}</p>
          </div>
          <div className="public-opening__news-heading">
            <h2 id="news-title">News &amp; Announcements</h2>
            <p id="news-review-note">{news.reviewNote}</p>
          </div>
        </header>

        <AnnouncementsSection>
          <div id="applicant-access" className="public-opening__access">
            {/* Compatibility targets retain account guidance, without a FAQ section. */}
            <span id="getting-started" className="public-opening__anchor" />
            <span id="faq" className="public-opening__anchor" />
            <h3>Applicant examination access</h3>
            <p>
              For applicants registered in Pinnacle. Sign in or{" "}
              <Link href="/register" aria-describedby="registration-guidance">
                create an account
              </Link>{" "}
              to access examination services.
            </p>
            <div className="public-opening__actions">
              <Link
                href={hero.programsHref}
                className="public-action public-action--primary"
              >
                Explore Programs <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link
                href="/login"
                className="public-action public-action--secondary"
              >
                Entrance Examination <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </div>
            <p
              id="registration-guidance"
              className="public-opening__prerequisite"
            >
              {hero.registrationGuidance}
            </p>
            <a
              href={contact.platforms[1].href}
              className="public-opening__pinnacle"
            >
              Apply through Pinnacle{" "}
              <ArrowUpRight aria-hidden="true" size={16} />
              <span className="sr-only"> (external application system)</span>
            </a>
          </div>
        </AnnouncementsSection>
      </div>
    </section>
  );
}
