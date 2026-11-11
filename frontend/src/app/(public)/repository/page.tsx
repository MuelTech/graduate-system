import { RepositoryBrowser } from "@/components/repository/repository-browser";

export default function RepositoryPage() {
  return (
    <>
      <header className="public-information-header">
        <div className="public-body-frame">
          <p className="public-body-eyebrow">EARIST Graduate School</p>
          <div className="public-information-header__layout">
            <h1 className="public-information-title">Research Repository</h1>
            <p className="public-information-lead">
              Explore published graduate research titles, abstracts, and
              citations from EARIST.
            </p>
          </div>
        </div>
      </header>

      {/* Live published research (metadata projection only) */}
      <section aria-label="Repository catalog" className="public-body-section">
        <div className="public-body-frame">
          <RepositoryBrowser
            title="Published Research Catalog"
            description="Explore approved graduate theses, dissertations, and research manuscripts. Institutional sign-in required for full-text downloads."
          />
        </div>
      </section>
    </>
  );
}
