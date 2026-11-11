import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#333333]">
          Academic Journey
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          High-level graduate progress. Detailed defense steps are under Thesis
          Journey.
        </p>
      </div>

      {loadFailed && (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-500">
            Unable to load your Academic Journey. Please try again later.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#333333]">Program progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {PHASES.map((phase) => (
              <li
                key={phase.label}
                className="flex flex-wrap items-start gap-3.5 rounded-xl border border-gray-100 bg-gray-50/40 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e02b20]/10 text-[#e02b20]">
                  <phase.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#333333]">
                    {phase.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {phase.blurb}
                  </p>
                  {phase.label === "Comprehensive Examination" && (
                    <p className="mt-1.5 text-xs font-medium text-[#333333]">
                      Status:{" "}
                      <span className="text-gray-600">
                        {loadFailed ? "Unavailable" : compExamLabel(compExamStatus)}
                      </span>
                    </p>
                  )}
                  {phase.label === "Thesis / Dissertation Phase" && (
                    <Link
                      href="/student/thesis"
                      className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2.5`}
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
