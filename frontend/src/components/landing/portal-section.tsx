import Link from "next/link";
import {
  UserCircle,
  GraduationCap,
  Presentation,
  Settings,
  ArrowRight,
} from "lucide-react";

const portals = [
  {
    icon: UserCircle,
    title: "Applicant Portal",
    description:
      "Register, check program alignment, schedule exams, and upload your Certificate of Registration.",
    href: "/register",
    color: "bg-[var(--earist-accent)]",
  },
  {
    icon: GraduationCap,
    title: "Student Portal",
    description:
      "Manage your thesis pipeline, track curriculum progress, and access the research repository.",
    href: "/login",
    color: "bg-[var(--earist-primary)]",
  },
  {
    icon: Presentation,
    title: "Panelist Portal",
    description:
      "Review defense materials, submit scores, and manage e-signatures for RAP reports.",
    href: "/login",
    color: "bg-[var(--earist-secondary)]",
  },
  {
    icon: Settings,
    title: "Administrator Portal",
    description:
      "Manage users, validate waivers, configure system settings, and view analytics.",
    href: "/login",
    color: "bg-[var(--earist-success)]",
  },
];

export function PortalSection() {
  return (
    <section className="bg-[var(--earist-surface-gray)] py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-[var(--earist-secondary)] sm:text-4xl">
            Role-Based Portals
          </h2>
          <p className="mb-12 text-lg text-[var(--earist-body-text)]">
            Access your personalized portal based on your role in the Graduate
            School system. Each portal is designed for your specific needs.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map((portal) => (
            <div
              key={portal.title}
              className="group flex flex-col rounded-lg border border-[var(--earist-border-gray)] bg-white p-6 transition-all hover:shadow-lg"
            >
              <div
                className={`mb-4 inline-flex rounded-full p-3 text-white ${portal.color}`}
              >
                <portal.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--earist-primary)]">
                {portal.title}
              </h3>
              <p className="mb-6 flex-1 text-sm text-[var(--earist-body-text)]">
                {portal.description}
              </p>
              <Link
                href={portal.href}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--earist-primary)] px-4 text-sm font-medium text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-surface-light-red)]"
              >
                Access Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
