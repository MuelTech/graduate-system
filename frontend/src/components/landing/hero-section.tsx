import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { AnnouncementsSection } from "./announcements-section";

export function HeroSection() {
  const { hero, contact } = publicSiteContent;
  return (
    <section
      id="news"
      aria-labelledby="landing-title"
      className="public-opening"
    >
      <AnnouncementsSection />
      <div id="applicant-access" className="public-opening__access">
        <span id="getting-started" className="public-opening__anchor" />
        <span id="faq" className="public-opening__anchor" />
        <div className="public-body-frame public-opening__access-inner">
          <div>
            <h2>For registered Pinnacle applicants</h2>
            <p>
              First time using this portal?{" "}
              <Link href="/register" aria-describedby="registration-guidance">
                Create an account
              </Link>{" "}
              to access examination services.
            </p>
            <p
              id="registration-guidance"
              className="public-opening__prerequisite"
            >
              {hero.registrationGuidance}
            </p>
          </div>
          <a
            href={contact.platforms[1].href}
            className="public-opening__pinnacle"
          >
            Apply through Pinnacle <ArrowUpRight aria-hidden="true" size={17} />
            <span className="sr-only"> (external application system)</span>
          </a>
        </div>
      </div>
    </section>
  );
}
