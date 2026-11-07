import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ProgramsSection() {
  return (
    <section
      id="graduate-study"
      aria-labelledby="graduate-study-title"
      className="scroll-mt-24 border-t border-(--earist-border-gray) bg-(--earist-surface-cream)"
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
        <h2
          id="graduate-study-title"
          className="max-w-md text-2xl leading-tight font-semibold text-foreground sm:text-3xl"
        >
          Graduate study at EARIST
        </h2>
        <div>
          <p className="max-w-md text-base leading-relaxed text-(--earist-body-text)">
            Explore graduate programs before completing your GS-IS registration.
          </p>
          <Link
            href="/programs"
            className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-md text-base font-semibold text-(--earist-primary) underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            View Programs
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
