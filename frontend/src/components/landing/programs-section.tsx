import Link from "next/link";
import { ArrowRight } from "lucide-react";

const programs = [
  {
    name: "Master of Arts in Education",
    type: "Masters",
    department: "College of Education",
    residency: "4 years",
  },
  {
    name: "Doctor of Education",
    type: "Doctoral",
    department: "College of Education",
    residency: "5 years",
  },
  {
    name: "Master of Science in Computer Science",
    type: "Masters",
    department: "College of Computing",
    residency: "4 years",
  },
  {
    name: "Master in Public Administration",
    type: "Masters",
    department: "College of Governance",
    residency: "4 years",
  },
  {
    name: "Doctor of Public Administration",
    type: "Doctoral",
    department: "College of Governance",
    residency: "5 years",
  },
  {
    name: "Master of Arts in Nursing",
    type: "Masters",
    department: "College of Nursing",
    residency: "4 years",
  },
];

export function ProgramsSection() {
  return (
    <section className="bg-(--earist-surface-gray) py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-(--earist-primary) sm:text-4xl">
            Graduate Programs Offered
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-(--earist-body-text)">
            Explore our comprehensive range of Masters and Doctoral programs
            designed to advance your career.
          </p>
        </div>

        {/* Program Cards Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div
              key={program.name}
              className="group overflow-hidden rounded-lg border border-(--earist-border-gray) bg-white shadow-sm transition-all hover:shadow-lg"
            >
              {/* Navy Top Border Accent */}
              <div className="h-2 bg-(--earist-primary)" />
              <div className="p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      program.type === "Masters"
                        ? "bg-(--earist-surface-light-red) text-(--earist-primary)"
                        : "bg-(--earist-surface-cream) text-(--earist-warning)"
                    }`}
                  >
                    {program.type}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-(--earist-primary)">
                  {program.name}
                </h3>
                <p className="mb-1 text-sm text-(--earist-body-text)">
                  {program.department}
                </p>
                <p className="text-sm text-(--earist-muted-foreground)">
                  Max Residency: {program.residency}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* View All Programs Link */}
        <div className="mt-10 text-center">
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary)"
          >
            View All Programs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
