import Link from "next/link";
import { apiServerRequest } from "@/lib/api.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Library,
  Megaphone,
  User,
} from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function compExamLabel(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "passed") return "Passed";
  if (s === "failed") return "Failed";
  if (s === "pending") return "Pending";
  return "Not taken";
}

/**
 * Student dashboard — high-level academic info only.
 * Detailed thesis progression lives in Thesis Journey (GET /thesis/journey).
 */
export default async function StudentDashboard() {
  let journey: Record<string, unknown> | null = null;
  let loadFailed = false;
  try {
    journey = await apiServerRequest("/student/journey");
  } catch {
    loadFailed = true;
  }

  const user = (journey?.user ?? {}) as {
    firstName?: string;
    lastName?: string;
  };
  const firstName = user.firstName || "Student";
  const program =
    (journey?.program as { programName?: string } | undefined)?.programName ||
    "Graduate Program";
  const studentNumber = (journey?.studentNumber as string) || "Not Assigned";
  const compExamStatus = (
    journey?.compExamRecords as Array<{ status?: string }> | undefined
  )?.[0]?.status;
  const requirementsSubmitted =
    (journey?.studentRequirements as unknown[] | undefined)?.length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          {getGreeting()}, {firstName}
        </h2>
        <p className="text-sm text-(--earist-body-text)">{program}</p>
        <p className="text-xs text-(--earist-body-text)">
          Student Number: {studentNumber}
        </p>
      </div>

      {loadFailed && (
        <Card>
          <CardContent className="pt-6 text-sm text-(--earist-body-text)">
            Unable to load your dashboard information. Please try again later.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Thesis Journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-(--earist-body-text)">
              View your current thesis/dissertation stage, requirements, and
              next action.
            </p>
            <Link href="/student/thesis" className={buttonVariants()}>
              Open Thesis Journey
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              Comprehensive Examination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">
              {compExamLabel(compExamStatus)}
            </Badge>
            <p className="mt-2 text-xs text-(--earist-body-text)">
              Required before Title Defense.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Academic Journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-(--earist-body-text)">
              High-level program phases from enrollment to completion.
            </p>
            <Link
              href="/student/journey"
              className={buttonVariants({ variant: "outline" })}
            >
              View Academic Journey
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Library className="h-4 w-4" />
              Research Repository
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-(--earist-body-text)">
              Browse published graduate research and submit completed work.
            </p>
            <p className="text-xs text-(--earist-body-text)">
              Requirements submitted: {requirementsSubmitted}
            </p>
            <Link
              href="/student/repository"
              className={buttonVariants({ variant: "outline" })}
            >
              Open Repository
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="h-4 w-4" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/student/announcements"
              className={buttonVariants({ variant: "outline" })}
            >
              View Announcements
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/student/notifications"
              className={buttonVariants({ variant: "outline" })}
            >
              View Notifications
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
