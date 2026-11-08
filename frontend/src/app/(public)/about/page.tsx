import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PreviewImage } from "@/components/landing/preview-image";
import { publicSiteContent } from "@/content/public-site-content";

export default function AboutPage() {
  const { about, institution } = publicSiteContent;

  return (
    <div className="public-school-about">
      <header className="public-information-header">
        <div className="public-body-frame public-school-about__introduction">
          <div>
            <p className="public-body-eyebrow">EARIST Graduate School</p>
            <h1 className="public-information-title">
              About the Graduate School
            </h1>
            <p className="public-information-lead">{institution.fullName}</p>
            <p className="public-body-copy">{about.introduction}</p>
          </div>
          <PreviewImage
            image={about.image}
            className="public-school-about__image"
            sizes="(min-width: 1248px) 480px, (min-width: 900px) 40vw, calc(100vw - 48px)"
          />
        </div>
      </header>

      <section
        aria-labelledby="graduate-school-goals"
        className="public-body-section"
      >
        <div className="public-body-frame public-school-about__goals-layout">
          <div>
            <p className="public-body-eyebrow">Purpose and direction</p>
            <h2 id="graduate-school-goals" className="public-body-title">
              Graduate School goals
            </h2>
            <p className="public-body-copy">
              Professional development, research, and leadership guide the
              Graduate School&apos;s published goals.
            </p>
            <p className="public-information-source">
              Adapted from the{" "}
              <a href={about.sourceHref}>official Graduate School goals</a>.
            </p>
          </div>
          <ol className="public-school-about__goals">
            {about.goals.map((goal) => (
              <li key={goal.title}>
                <h3>{goal.title}</h3>
                <p>{goal.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="earist-institutional-context"
        className="public-body-section public-school-about__institution"
      >
        <div className="public-body-frame public-school-about__goals-layout">
          <div>
            <p className="public-body-eyebrow">The wider institution</p>
            <h2 id="earist-institutional-context" className="public-body-title">
              Part of EARIST
            </h2>
          </div>
          <div>
            <p className="public-information-lead">
              {about.institutionalContext}
            </p>
            <a href={about.institutionSourceHref} className="public-body-link">
              About EARIST <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
      </section>

      <aside
        aria-label="Explore study and research"
        className="public-information-pathways"
      >
        <div className="public-body-frame">
          <Link href="/programs" className="public-body-link">
            View Graduate Programs <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <Link href="/repository" className="public-body-link">
            Browse Research Repository <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </aside>
    </div>
  );
}
