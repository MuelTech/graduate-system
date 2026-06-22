import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";

const recentResearch = [
  {
    title: "Impact of Technology Integration on Graduate Student Performance",
    program: "Master of Arts in Education",
    author: "Maria Santos",
    year: "2025",
    abstract:
      "This study examines the effects of technology integration on academic performance among graduate students in education programs...",
  },
  {
    title: "Public Policy Implementation in Local Government Units",
    program: "Doctor of Public Administration",
    author: "Juan dela Cruz",
    year: "2025",
    abstract:
      "An analysis of public policy implementation challenges and success factors in Philippine local government units...",
  },
  {
    title: "Cybersecurity Framework for Philippine HEIs",
    program: "Master of Science in Computer Science",
    author: "Ana Reyes",
    year: "2024",
    abstract:
      "Developing a comprehensive cybersecurity framework tailored for Philippine Higher Education Institutions...",
  },
];

export function RepositorySection() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-(--earist-primary) sm:text-4xl">
            Published Graduate Research
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-(--earist-body-text)">
            Browse our collection of thesis and dissertation research from
            graduate school alumni.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mx-auto mb-10 max-w-xl">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-(--earist-body-text)" />
            <input
              type="text"
              placeholder="Search by title, author, program, or keyword..."
              className="w-full rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 pr-4 pl-10 text-sm text-(--earist-body-text) transition-colors focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) focus:outline-none"
            />
          </div>
        </div>

        {/* Research Preview Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {recentResearch.map((research) => (
            <div
              key={research.title}
              className="flex flex-col rounded-lg border border-(--earist-border-gray) bg-white p-6 transition-all hover:shadow-lg"
            >
              <div className="mb-2">
                <span className="inline-flex rounded-full bg-(--earist-surface-light-red) px-2.5 py-0.5 text-xs font-semibold text-(--earist-primary)">
                  {research.program}
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-(--earist-primary)">
                {research.title}
              </h3>
              <p className="mb-1 text-sm text-(--earist-body-text)">
                {research.author} • {research.year}
              </p>
              <p className="mb-4 line-clamp-3 flex-1 text-sm text-(--earist-body-text)">
                {research.abstract}
              </p>
              <Link
                href="/repository"
                className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary)"
              >
                Read More
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>

        {/* Browse Full Repository Button */}
        <div className="mt-10 text-center">
          <Link
            href="/repository"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-(--earist-primary) px-6 text-sm font-semibold text-white transition-colors hover:bg-(--earist-primary)/90"
          >
            Browse Full Repository
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
