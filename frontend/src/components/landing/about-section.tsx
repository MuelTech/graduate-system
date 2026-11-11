import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

export function AboutSection() {
  const { about, institution } = publicSiteContent;

  return (
    <section
      id="about"
      aria-labelledby="graduate-school-about-title"
      className="public-body-section public-about"
    >
      <div className="public-body-frame">
        <div className="public-about__layout">
          <div className="public-about__copy">
            <p className="public-body-eyebrow">About the Graduate School</p>
            <h2 id="graduate-school-about-title" className="public-body-title">
              The Graduate School at EARIST
            </h2>
            <p className="public-body-copy">{about.introduction}</p>
            <p className="public-body-copy">
              As part of {institution.fullName}, the Graduate School prepares
              educators, researchers, public administrators, business leaders,
              and specialists for advanced scholarship and service.
            </p>
            <div className="public-about__context">
              <p className="public-about__context-label">
                Institutional mandate
              </p>
              <p className="public-about__context-copy">
                {about.institutionalContext}
              </p>
            </div>
          </div>
          <PreviewImage
            showCaption={false}
            image={about.image}
            className="public-about__image"
            sizes="(min-width: 1248px) 480px, (min-width: 900px) 43vw, 100vw"
          />
        </div>

        <div
          className="public-about__goals-band"
          aria-labelledby="home-graduate-school-goals"
        >
          <div className="public-about__goals-header">
            <h3 id="home-graduate-school-goals">Graduate School Goals</h3>
            <p>
              Guided by excellence, integrity, and service across master&apos;s
              and doctoral education.
            </p>
          </div>
          <ol className="public-about__goals-grid">
            {about.goals.map((goal) => (
              <li key={goal.title} className="public-about__goal-item">
                <h4>{goal.title}</h4>
                <p>{goal.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
