import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Quote } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

const repositoryFeatures = [
  {
    icon: BookOpen,
    title: "Theses & Dissertations",
    description:
      "Search approved master's theses and doctoral dissertations across all Graduate School disciplines.",
  },
  {
    icon: Quote,
    title: "Abstracts & Citations",
    description:
      "Review research abstracts, keywords, and ready-to-copy academic citation formats.",
  },
  {
    icon: FileText,
    title: "Institutional Full-Text Access",
    description:
      "Authenticated EARIST students and faculty can view and download available full-text manuscripts.",
  },
];

export function RepositorySection() {
  return (
    <section
      id="graduate-research"
      aria-labelledby="graduate-research-title"
      className="public-body-section public-research"
    >
      <div className="public-body-frame public-research__layout">
        <div>
          <p className="public-body-eyebrow">Research</p>
          <h2 id="graduate-research-title" className="public-body-title">
            Graduate research at EARIST
          </h2>
          <p className="public-body-copy">
            Discover scholarly works produced by EARIST graduate students and
            faculty. The Research Repository preserves approved theses and
            dissertations to support ongoing academic inquiry and innovation.
          </p>

          <ul className="public-research__features">
            {repositoryFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="public-research__feature-item">
                  <span className="public-research__feature-icon">
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link href="/repository" className="public-research__action">
            Browse Research Repository{" "}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
        <PreviewImage
          showCaption={false}
          image={publicSiteContent.research.image}
          className="public-research__image"
          sizes="(min-width: 1248px) 455px, (min-width: 900px) 40vw, 100vw"
        />
      </div>
    </section>
  );
}
