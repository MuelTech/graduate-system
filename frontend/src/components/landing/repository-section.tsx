import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

export function RepositorySection() {
  return (
    <section
      id="graduate-research"
      aria-labelledby="graduate-research-title"
      className="public-body-section public-research"
    >
      <div className="public-body-frame public-research__layout">
        <div>
          <p className="public-body-eyebrow">Research Repository</p>
          <h2 id="graduate-research-title" className="public-body-title">
            Graduate research at EARIST
          </h2>
          <p className="public-body-copy">
            Explore published research titles, abstracts, and citations in the
            Research Repository.
          </p>
          <Link href="/repository" className="public-research__action">
            Browse Research Repository{" "}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <p className="public-research__access">
            Full-text access requires institutional sign-in where a manuscript
            is available.
          </p>
        </div>
        <PreviewImage
          image={publicSiteContent.research.image}
          className="public-research__image"
          sizes="(min-width: 1248px) 455px, (min-width: 900px) 40vw, 100vw"
        />
      </div>
    </section>
  );
}
