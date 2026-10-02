import { RepositoryBrowser } from "@/components/repository/repository-browser";

export default function RepositoryPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-(--earist-primary) py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-white">
            Research Repository
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Browse published thesis and dissertation research metadata from
            EARIST Graduate School students and alumni.
          </p>
        </div>
      </section>

      {/* Live published research (metadata projection only) */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <RepositoryBrowser
            title="Published Research"
            description="Published metadata only. Full-text manuscript availability is not yet enabled."
          />
        </div>
      </section>
    </>
  );
}
