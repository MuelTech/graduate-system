import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

export function ProgramsSection() {
  return (
    <section
      id="programs"
      aria-labelledby="graduate-study-title"
      className="public-body-section public-programs"
    >
      <span
        id="graduate-study"
        className="public-programs__legacy-anchor"
        aria-hidden="true"
      />
      <div className="public-body-frame">
        <div className="public-programs__intro">
          <div>
            <p className="public-body-eyebrow">Graduate study</p>
            <h2 id="graduate-study-title" className="public-body-title">
              Explore graduate programs
            </h2>
          </div>
          <div>
            <p className="public-body-copy">
              Browse master&apos;s and doctoral study options before continuing
              to GS-IS registration.
            </p>
            <Link href="/programs" className="public-body-link">
              View All Graduate Programs{" "}
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
        <p id="programs-review-note" className="public-programs__review-note">
          {publicSiteContent.programs.reviewNote}{" "}
          {publicSiteContent.programs.sources.map((source, index) => (
            <span key={source.href}>
              {index > 0 && " · "}
              <a
                href={source.href}
                aria-label={`Official EARIST Graduate School ${source.label.toLowerCase()}`}
                className="underline underline-offset-2"
              >
                {source.label}
              </a>
            </span>
          ))}
        </p>
        <div className="public-programs__directory">
          {publicSiteContent.programs.groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`programs-${group.id}`}
              aria-describedby="programs-review-note"
            >
              <h3
                id={`programs-${group.id}`}
                className="public-programs__group-title"
              >
                {group.title}
              </h3>
              <ul className="public-programs__list">
                {group.entries.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
