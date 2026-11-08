import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

export function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="graduate-school-about-title"
      className="public-body-section public-about"
    >
      <div className="public-body-frame public-about__layout">
        <div className="public-about__copy">
          <p className="public-body-eyebrow">About the Graduate School</p>
          <h2 id="graduate-school-about-title" className="public-body-title">
            The Graduate School at EARIST
          </h2>
          <p className="public-body-copy">
            The Graduate School is part of Eulogio &quot;Amang&quot; Rodriguez
            Institute of Science and Technology.
          </p>
          <p className="public-body-copy">
            Use this public site to explore program information and published
            research. Sign in to GS-IS for existing account services.
          </p>
        </div>
        <PreviewImage
          image={publicSiteContent.about.image}
          className="public-about__image"
          sizes="(min-width: 1248px) 480px, (min-width: 900px) 43vw, 100vw"
        />
      </div>
    </section>
  );
}
