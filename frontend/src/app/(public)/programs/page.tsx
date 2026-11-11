import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

export default function ProgramsPage() {
  const { programs } = publicSiteContent;

  return (
    <div className="public-program-directory">
      <header className="public-information-header">
        <div className="public-body-frame">
          <p className="public-body-eyebrow">EARIST Graduate School</p>
          <div className="public-information-header__layout">
            <h1 className="public-information-title">Graduate programs</h1>
            <p className="public-information-lead">
              Explore master&apos;s and doctoral programs and their published
              majors at the Graduate School.
            </p>
          </div>
          <nav
            aria-label="Degree groups"
            className="public-program-directory__navigation"
          >
            {programs.groups.map((group) => (
              <a
                key={group.id}
                href={`#${group.id}-programs`}
                className="public-body-link"
              >
                {group.title}
                <ArrowRight aria-hidden="true" size={18} />
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="public-body-section">
        <div className="public-body-frame">
          <div className="public-program-directory__groups">
            {programs.groups.map((group) => (
              <section key={group.id} aria-labelledby={`${group.id}-programs`}>
                <h2
                  id={`${group.id}-programs`}
                  tabIndex={-1}
                  className="public-program-directory__group-title"
                >
                  {group.title}
                </h2>
                <ul className="public-program-directory__list">
                  {group.entries.map((program) => (
                    <li key={program.name}>
                      <h3>{program.name}</h3>
                      {program.majors.length > 0 && (
                        <div className="public-program-directory__majors">
                          <p>Major in:</p>
                          <ul>
                            {program.majors.map((major) => (
                              <li key={major}>{major}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="public-information-source">
            Program information:{" "}
            <a href={programs.sourceHref}>EARIST Graduate School</a>.
          </p>
        </div>
      </div>

      <aside
        aria-label="Explore the Graduate School"
        className="public-information-pathways"
      >
        <div className="public-body-frame">
          <Link href="/about" className="public-body-link">
            About the Graduate School <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <Link href="/repository" className="public-body-link">
            Browse Research Repository <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </aside>
    </div>
  );
}
