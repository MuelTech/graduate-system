import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="bg-(--earist-primary) py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Ready to Begin Your Graduate Journey?
          </h2>
          <p className="mb-8 text-lg text-white/80">
            Register using your Pinnacle Applicant ID to access the Graduate
            School Information System for entrance examination and academic
            tracking.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-(--earist-accent) px-8 text-sm font-medium text-(--earist-body-text) transition-colors hover:bg-(--earist-accent)/90"
            >
              Start Your Application
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/programs"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white px-8 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              View Programs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
