import { GraduationCap, Target, Eye, Users, Award, BookOpen } from "lucide-react";

const stats = [
  { icon: Users, label: "Active Students", value: "500+" },
  { icon: BookOpen, label: "Graduate Programs", value: "15+" },
  { icon: Award, label: "Published Research", value: "100+" },
  { icon: GraduationCap, label: "Alumni", value: "2,000+" },
];

export default function AboutPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-[var(--earist-primary)] py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-white">
            About the System
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Learn about the EARIST Graduate School Information System and its
            mission to streamline graduate education management.
          </p>
        </div>
      </section>

      {/* About Content */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-[var(--earist-primary)]">
                EARIST Graduate School Information System
              </h2>
              <p className="mb-4 text-[var(--earist-body-text)]">
                The EARIST Graduate School Information System (GS-IS) is a
                comprehensive portal-based platform designed to manage the
                complete student lifecycle from applicant admission through
                thesis or dissertation final defense and Research Repository
                archiving.
              </p>
              <p className="mb-4 text-[var(--earist-body-text)]">
                The system enforces strict role-based access control and
                integrates with Pinnacle, the institutional enrollment system,
                for Applicant ID issuance, initial payment processing,
                enrollment, and Certificate of Registration (COR) generation.
              </p>
              <p className="text-[var(--earist-body-text)]">
                Built with modern web technologies including Next.js, TypeScript,
                and Tailwind CSS, the GS-IS provides a responsive and accessible
                interface for all user roles: Administrators, Students,
                Panelists, Applicants, and Custom roles.
              </p>
            </div>

            {/* Mission & Vision */}
            <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--earist-border-gray)] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-6 w-6 text-[var(--earist-accent)]" />
                  <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                    Mission
                  </h3>
                </div>
                <p className="text-sm text-[var(--earist-body-text)]">
                  To provide a centralized, efficient, and transparent digital
                  platform that streamlines graduate school operations — from
                  admissions to research publication — while maintaining the
                  highest standards of academic integrity and data security.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--earist-border-gray)] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Eye className="h-6 w-6 text-[var(--earist-accent)]" />
                  <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                    Vision
                  </h3>
                </div>
                <p className="text-sm text-[var(--earist-body-text)]">
                  To be the leading graduate school management system in the
                  Philippines, empowering academic institutions with technology
                  that enhances the quality of graduate education and research
                  output.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-12 grid grid-cols-2 gap-6 md:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center rounded-lg bg-[var(--earist-surface-light-red)] p-6 text-center"
                >
                  <stat.icon className="mb-3 h-8 w-8 text-[var(--earist-accent)]" />
                  <span className="text-2xl font-bold text-[var(--earist-primary)]">
                    {stat.value}
                  </span>
                  <span className="text-sm text-[var(--earist-body-text)]">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Key Features */}
            <div>
              <h2 className="mb-6 text-2xl font-bold text-[var(--earist-primary)]">
                Key Features
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  "Role-based access control for all user types",
                  "Automated program alignment check",
                  "Thesis pipeline management (Title to Final Defense)",
                  "Integrated plagiarism detection (STRIKE)",
                  "Real-time notifications and email alerts",
                  "NLP-powered AI chatbot assistant",
                  "Mobile-optimized panelist scoring",
                  "Digital signatures for RAP Reports",
                  "Research Repository with public browse",
                  "Comprehensive analytics and reporting",
                ].map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-2 rounded-lg border border-[var(--earist-border-gray)] p-3"
                  >
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--earist-accent)]" />
                    <span className="text-sm text-[var(--earist-body-text)]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
