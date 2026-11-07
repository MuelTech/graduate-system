import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

export function HeroSection() {
  const { hero, institution } = publicSiteContent;

  return (
    <section aria-labelledby="landing-title" className="public-hero">
      <div className="public-hero__composition">
        <div className="public-hero__copy">
          <p className="public-hero__institution">{institution.fullName}</p>
          <p className="public-hero__eyebrow">{hero.serviceLabel}</p>
          <h1 id="landing-title" className="public-hero__title">
            EARIST <span>Graduate School</span>
          </h1>
          <p className="public-hero__description">{hero.description}</p>
          <div className="public-hero__actions">
            <Link
              href={hero.programsHref}
              className="public-action public-action--primary"
            >
              Explore Programs
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              href="/register"
              aria-describedby="registration-guidance"
              className="public-action public-action--secondary"
            >
              Register for GS-IS
            </Link>
          </div>
          <p id="registration-guidance" className="public-hero__prerequisite">
            {hero.registrationGuidance}
          </p>
        </div>
        <PreviewImage
          image={hero.image}
          className="public-hero__visual"
          sizes="(min-width: 1248px) 580px, (min-width: 960px) calc((100vw - 88px) / 2), (min-width: 600px) calc(100vw - 48px), calc(100vw - 36px)"
          priority
        />
      </div>
    </section>
  );
}
