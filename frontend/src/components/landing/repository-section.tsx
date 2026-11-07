import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function RepositorySection() {
  return (
    <section
      id="graduate-research"
      aria-labelledby="graduate-research-title"
      className="scroll-mt-24 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2
          id="graduate-research-title"
          className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          Graduate research
        </h2>
        <div className="mt-6 grid gap-6 border-t border-(--earist-border-gray) pt-6 lg:grid-cols-2 lg:gap-12">
          <p className="max-w-md text-lg leading-relaxed text-(--earist-body-text)">
            Browse published thesis and dissertation metadata in the Research
            Repository.
          </p>
          <div>
            <p className="max-w-md text-base leading-relaxed text-(--earist-body-text)">
              Institutional sign-in is required for full-text downloads.
            </p>
            <Link
              href="/repository"
              className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-md text-base font-semibold text-(--earist-primary) underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Browse Research Repository
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
