import { Search, Download, Eye } from "lucide-react";

const researchEntries = [
  {
    title:
      "Impact of Technology Integration on Graduate Student Performance in Education",
    program: "Master of Arts in Education",
    author: "Maria Santos",
    year: "2025",
    abstract:
      "This study examines the effects of technology integration on academic performance among graduate students in education programs. Using a mixed-methods approach, the research surveyed 150 graduate students and conducted in-depth interviews with 20 faculty members to understand the perceptions, challenges, and outcomes of technology-enhanced learning environments.",
    keywords: ["technology integration", "graduate education", "performance"],
  },
  {
    title:
      "Public Policy Implementation Challenges in Philippine Local Government Units",
    program: "Doctor of Public Administration",
    author: "Juan dela Cruz",
    year: "2025",
    abstract:
      "An analysis of public policy implementation challenges and success factors in Philippine local government units. The study identifies key barriers including bureaucratic red tape, limited resources, and political dynamics that affect policy execution at the local level.",
    keywords: ["public policy", "local government", "governance"],
  },
  {
    title:
      "Cybersecurity Framework Development for Philippine Higher Education Institutions",
    program: "Master of Science in Computer Science",
    author: "Ana Reyes",
    year: "2024",
    abstract:
      "Developing a comprehensive cybersecurity framework tailored for Philippine Higher Education Institutions. The research proposes a multi-layered security architecture addressing common vulnerabilities in academic networks and data management systems.",
    keywords: ["cybersecurity", "HEIs", "framework"],
  },
  {
    title:
      "Nursing Leadership Competencies and Patient Outcomes in Metro Manila Hospitals",
    program: "Master of Arts in Nursing",
    author: "Rosa Garcia",
    year: "2024",
    abstract:
      "This study investigates the relationship between nursing leadership competencies and patient outcomes in selected Metro Manila hospitals. Findings suggest that transformational leadership styles significantly correlate with improved patient satisfaction and care quality metrics.",
    keywords: ["nursing leadership", "patient outcomes", "healthcare"],
  },
  {
    title:
      "Optimization of Manufacturing Processes Using Lean Six Sigma Methodologies",
    program: "Master of Science in Industrial Engineering",
    author: "Carlos Mendoza",
    year: "2024",
    abstract:
      "Application of Lean Six Sigma methodologies to optimize manufacturing processes in small and medium enterprises. The study demonstrates a 35% reduction in production waste and 20% improvement in throughput time across three case study companies.",
    keywords: ["lean six sigma", "manufacturing", "optimization"],
  },
  {
    title:
      "Mathematical Modeling of Disease Spread in Urban Philippine Communities",
    program: "Master of Arts in Mathematics",
    author: "Elena Bautista",
    year: "2023",
    abstract:
      "A mathematical modeling approach to understanding disease transmission dynamics in densely populated Philippine urban communities. The model incorporates population density, mobility patterns, and public health interventions to predict outbreak trajectories.",
    keywords: ["mathematical modeling", "epidemiology", "urban health"],
  },
];

export default function RepositoryPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-[var(--earist-primary)] py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-white">
            Research Repository
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Browse published thesis and dissertation research from EARIST
            Graduate School students and alumni.
          </p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="bg-[var(--earist-surface-gray)] py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--earist-body-text)]" />
              <input
                type="text"
                placeholder="Search by title, author, program, or keyword..."
                className="w-full rounded-lg border border-[var(--earist-border-gray)] bg-white py-3 pl-10 pr-4 text-sm transition-colors focus:border-[var(--earist-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--earist-primary)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Research Entries */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-[var(--earist-body-text)]">
              Showing {researchEntries.length} research entries
            </p>
            <select className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none">
              <option>All Programs</option>
              <option>Master of Arts in Education</option>
              <option>Doctor of Public Administration</option>
              <option>Master of Science in Computer Science</option>
              <option>Master of Arts in Nursing</option>
              <option>Master of Science in Industrial Engineering</option>
              <option>Master of Arts in Mathematics</option>
            </select>
          </div>

          <div className="space-y-6">
            {researchEntries.map((entry) => (
              <div
                key={entry.title}
                className="rounded-lg border border-[var(--earist-border-gray)] p-6 transition-all hover:shadow-md"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-[var(--earist-surface-light-red)] px-2.5 py-0.5 text-xs font-semibold text-[var(--earist-primary)]">
                    {entry.program}
                  </span>
                  <span className="text-xs text-[var(--earist-body-text)]">
                    {entry.year}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[var(--earist-primary)]">
                  {entry.title}
                </h3>
                <p className="mb-2 text-sm text-[var(--earist-secondary)]">
                  by {entry.author}
                </p>
                <p className="mb-3 text-sm text-[var(--earist-body-text)]">
                  {entry.abstract}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {entry.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-[var(--earist-surface-gray)] px-2 py-0.5 text-xs text-[var(--earist-body-text)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button className="inline-flex items-center gap-1 rounded-lg border border-[var(--earist-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-surface-light-red)]">
                    <Eye className="h-3 w-3" />
                    View Abstract
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-[var(--earist-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90">
                    <Download className="h-3 w-3" />
                    Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
