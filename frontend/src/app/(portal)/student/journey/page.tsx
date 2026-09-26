import Link from "next/link";
import { unstable_rethrow } from "next/dist/client/components/unstable-rethrow";
import { apiServerRequest } from "@/lib/api.server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  BookOpen,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Library,
  UserPlus,
} from "lucide-react";

/**
 * Academic Journey — high-level only (no Thesis sub-steps).
 * Detailed Title / Adviser / Proposal / STRIKE / Final live under Thesis Journey.
 */
const PHASES = [
  {
    label: "Admissions / Enrollment",
    icon: UserPlus,
    href: "/student/profile",
    blurb: "Application, acceptance, and enrollment records.",
  },
  {
    label: "Coursework / Curriculum",
    icon: BookOpen,
    href: "/student/curriculum",
    blurb: "Graduate courses and program requirements.",
  },
  {
    label: "Comprehensive Examination",
    icon: ClipboardList,
    href: "/student/dashboard",
    blurb: "Comprehensive examination result (required before Title Defense).",
  },
  {
    label: "Thesis / Dissertation Phase",
    icon: FileCheck2,
    href: "/student/thesis",
    blurb: "Open Thesis Journey for Title, Adviser Request, Proposal, STRIKE, and Final Defense.",
  },
  {
    label: "Research Completion",
    icon: Library,
    href: "/student/repository",
    blurb: "Manuscript completion and repository submission.",
  },
  {
    label: "Graduation / Completion",
    icon: GraduationCap,
    href: "/student/dashboard",
    blurb: "Clearance and completion of the graduate program.",
  },
];

function compExamLabel(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "passed") return "Passed";
  if (s === "failed") return "Failed";
  if (s === "pending") return "Pending";
  return "Not taken";
}

export default async function StudentAcademicJourneyPage() {
  let compExamStatus: string | undefined;
  let loadFailed = false;
  try {
    const data = await apiServerRequest("/student/journey");
    compExamStatus = data?.compExamRecords?.[0]?.status as string | undefined;
  } catch (error) {
    // Preserve Next.js redirect/navigation exceptions (e.g. 401 → /login).
    unstable_rethrow(error);
    loadFailed = true;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Academic Journey
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          High-level graduate progress. Detailed defense steps are under Thesis
          Journey.
        </p>
      </div>

      {loadFailed && (
        <Card>
          <CardContent className="pt-6 text-sm text-(--earist-body-text)">
            Unable to load your Academic Journey. Please try again later.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Program progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {PHASES.map((phase) => (
              <li
                key={phase.label}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-(--earist-border-gray) p-3"
              >
                <phase.icon className="mt-0.5 h-5 w-5 text-(--earist-secondary)" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-(--earist-primary)">
                    {phase.label}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {phase.blurb}
                  </p>
                  {phase.label === "Comprehensive Examination" && (
                    <p className="mt-1 text-xs text-(--earist-body-text)">
                      Status:{" "}
                      {loadFailed
                        ? "Status unavailable"
                        : compExamLabel(compExamStatus)}
                    </p>
                  )}
                  {phase.label === "Thesis / Dissertation Phase" && (
                    <Link
                      href="/student/thesis"
                      className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2`}
                    >
                      Open Thesis Journey
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
