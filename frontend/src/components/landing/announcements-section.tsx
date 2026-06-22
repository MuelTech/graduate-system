import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

const announcements = [
  {
    date: "June 1, 2026",
    title: "Graduate School Entrance Examination Schedule for AY 2026-2027",
    href: "/faq",
  },
  {
    date: "May 28, 2026",
    title: "New Policy on Program Alignment and Bridging Waiver Requirements",
    href: "/faq",
  },
  {
    date: "May 20, 2026",
    title: "Call for Papers: Graduate School Research Colloquium 2026",
    href: "/repository",
  },
  {
    date: "May 15, 2026",
    title: "Updated STRIKE Plagiarism Check Threshold for Final Defense",
    href: "/faq",
  },
  {
    date: "May 10, 2026",
    title: "Enrollment Period for First Semester AY 2026-2027 Now Open",
    href: "/faq",
  },
];

export function AnnouncementsSection() {
  return (
    <section className="bg-(--earist-surface-gray) py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-(--earist-primary) sm:text-3xl">
            News & Announcements
          </h2>
          <Link
            href="/faq"
            className="hidden items-center gap-1 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary) sm:flex"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Horizontal Scrollable Strip */}
        <div className="flex scrollbar-thin scrollbar-thumb-(--earist-border-gray) gap-4 overflow-x-auto pb-4">
          {announcements.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex min-w-[300px] flex-col rounded-lg border border-(--earist-border-gray) bg-white p-4 transition-all hover:shadow-md sm:min-w-[350px]"
            >
              {/* Date Badge */}
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-(--earist-accent)" />
                <span className="text-xs font-medium text-(--earist-body-text)">
                  {item.date}
                </span>
              </div>

              {/* Title */}
              <h3 className="mb-2 flex-1 text-sm font-semibold text-(--earist-primary)">
                {item.title}
              </h3>

              {/* Read More */}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
                Read More
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>

        {/* Mobile View All Link */}
        <div className="mt-4 text-center sm:hidden">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary)"
          >
            View All Announcements
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
