import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

const programs = [
  {
    name: "Master of Arts in Education",
    code: "MAED",
    type: "Masters",
    department: "College of Education",
    residency: "4 years",
    description:
      "Advanced studies in educational leadership, curriculum development, and pedagogical research for education professionals.",
  },
  {
    name: "Doctor of Education",
    code: "EdD",
    type: "Doctoral",
    department: "College of Education",
    residency: "5 years",
    description:
      "Doctoral program focused on educational innovation, policy research, and advanced leadership in academic institutions.",
  },
  {
    name: "Master of Science in Computer Science",
    code: "MSCS",
    type: "Masters",
    department: "College of Computing",
    residency: "4 years",
    description:
      "Graduate program covering advanced computing concepts, software engineering, data science, and cybersecurity.",
  },
  {
    name: "Master in Public Administration",
    code: "MPA",
    type: "Masters",
    department: "College of Governance",
    residency: "4 years",
    description:
      "Prepares professionals for leadership roles in public service, governance, and policy implementation.",
  },
  {
    name: "Doctor of Public Administration",
    code: "DPA",
    type: "Doctoral",
    department: "College of Governance",
    residency: "5 years",
    description:
      "Doctoral program for advanced research in public administration, governance, and public policy analysis.",
  },
  {
    name: "Master of Arts in Nursing",
    code: "MAN",
    type: "Masters",
    department: "College of Nursing",
    residency: "4 years",
    description:
      "Advanced nursing practice, healthcare management, and nursing education for professional nurses.",
  },
  {
    name: "Master of Science in Industrial Engineering",
    code: "MSIE",
    type: "Masters",
    department: "College of Engineering",
    residency: "4 years",
    description:
      "Focuses on systems optimization, operations research, and industrial process improvement methodologies.",
  },
  {
    name: "Master of Arts in Mathematics",
    code: "MAM",
    type: "Masters",
    department: "College of Arts and Sciences",
    residency: "4 years",
    description:
      "Advanced mathematical theories, research methods, and applications in education and industry.",
  },
  {
    name: "Doctor of Philosophy in Education",
    code: "PhD-Ed",
    type: "Doctoral",
    department: "College of Education",
    residency: "5 years",
    description:
      "Research-intensive doctoral program producing scholars and researchers in the field of education.",
  },
];

export default function ProgramsPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-(--earist-primary) py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-white">
            Graduate Programs Offered
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Explore our comprehensive range of Masters and Doctoral programs
            designed to advance your professional career and academic pursuits.
          </p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="bg-(--earist-surface-gray) py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                placeholder="Search programs by name or department..."
                className="w-full rounded-lg border border-(--earist-border-gray) bg-white py-3 pr-4 pl-10 text-sm transition-colors focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Programs Grid */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <div
                key={program.code}
                className="flex flex-col overflow-hidden rounded-lg border border-(--earist-border-gray) transition-all hover:shadow-lg"
              >
                {/* Navy Top Border */}
                <div className="h-2 bg-(--earist-primary)" />
                <div className="flex flex-1 flex-col p-6">
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
                    <span className="text-xs text-(--earist-body-text)">
                      {program.code}
                    </span>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-(--earist-primary)">
                    {program.name}
                  </h3>
                  <p className="mb-1 text-sm text-(--earist-secondary)">
                    {program.department}
                  </p>
                  <p className="mb-3 text-xs text-(--earist-body-text)">
                    Max Residency: {program.residency}
                  </p>
                  <p className="mb-4 flex-1 text-sm text-(--earist-body-text)">
                    {program.description}
                  </p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary)"
                  >
                    Apply for this Program
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-(--earist-surface-light-red) py-12">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-(--earist-primary)">
            Ready to Start Your Graduate Journey?
          </h2>
          <p className="mb-6 text-(--earist-body-text)">
            Applications are now open for the upcoming academic year.
          </p>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-(--earist-accent) px-8 text-base font-bold text-(--earist-primary) transition-colors hover:bg-(--earist-accent)/90"
          >
            Apply for Admission
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
