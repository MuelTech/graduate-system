import { GraduationCap } from "lucide-react";
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
            <p className="public-body-eyebrow">Academic Offerings</p>
            <h2 id="graduate-study-title" className="public-body-title">
              Explore graduate programs
            </h2>
          </div>
          <div>
            <p className="public-body-copy">
              Pursue advanced studies across seven master&apos;s and four
              doctoral degree programs designed to develop scholarly competence,
              professional mastery, and ethical leadership.
            </p>
          </div>
        </div>

        <div className="public-programs__directory">
          {publicSiteContent.programs.groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`programs-${group.id}`}
              className="public-programs__panel"
            >
              <div className="public-programs__panel-header">
                <div className="public-programs__panel-heading">
                  <GraduationCap aria-hidden="true" size={22} />
                  <h3
                    id={`programs-${group.id}`}
                    className="public-programs__group-title"
                  >
                    {group.title}
                  </h3>
                </div>
                <span className="public-programs__count">
                  {group.entries.length} Degree Programs
                </span>
              </div>

              <ul className="public-programs__list">
                {group.entries.map((program) => (
                  <li key={program.name} className="public-programs__item">
                    <span className="public-programs__degree-name">
                      {program.name}
                    </span>
                    {program.majors.length > 0 && (
                      <div className="public-programs__majors">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
