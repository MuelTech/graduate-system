"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COURSE_STATUS_LABEL,
  COURSE_STATUS_TONE,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_TONE,
  formatShortDate,
} from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import type {
  CurriculumChecklistCourse,
  CurriculumChecklistGroup,
  StudentCurriculumChecklistDto,
} from "@/types/curriculum";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-[#8b1a1a] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CurriculumSummaryStrip({
  checklist,
}: {
  checklist: StudentCurriculumChecklistDto;
}) {
  const { curriculumVersion, summary, student } = checklist;
  if (!curriculumVersion || !summary) return null;

  return (
    <Card className="border-gray-200/80 border-t-4 border-t-[#8b1a1a] shadow-xs">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="space-y-1.5 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Assigned Curriculum
            </p>
            <p className="text-sm font-semibold text-[#262220]">
              {curriculumVersion.label}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              <span className="font-mono">{curriculumVersion.versionCode}</span>
              {curriculumVersion.effectiveSchoolYear ? (
                <span>· {curriculumVersion.effectiveSchoolYear}</span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Coursework Units (WCE Ref.)
            </p>
            <p className="text-sm font-semibold text-[#262220]">
              {summary.wceEarnedUnits} / {summary.wceRequiredUnits} units
            </p>
            <ProgressBar
              value={summary.wceEarnedUnits}
              max={summary.wceRequiredUnits}
            />
            <p className="text-xs text-gray-500">
              {summary.wceVerifiedUnits} verified · {summary.wceInProgressUnits}{" "}
              in progress
            </p>
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Total Degree Units
            </p>
            <p className="text-sm font-semibold text-[#262220]">
              {summary.totalEarnedUnits} / {summary.totalRequiredUnits} units (
              {summary.completionPercent}%)
            </p>
            <ProgressBar
              value={summary.totalEarnedUnits}
              max={summary.totalRequiredUnits}
            />
            <p className="text-xs text-gray-500">
              {summary.totalRemainingUnits} units remaining
            </p>
          </div>

          <div className="space-y-1.5 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Unofficial GWA (§7.9)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#262220]">
                {summary.unofficialGwa !== null
                  ? summary.unofficialGwa.toFixed(2)
                  : "—"}
              </p>
              {summary.meetsRetentionGwa === true ? (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
                >
                  Meets retention
                </Badge>
              ) : summary.meetsRetentionGwa === false ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 font-medium text-amber-800"
                >
                  Above {summary.retentionGwaThreshold.toFixed(2)} limit
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              {student.programType === "DOCTORAL" ? "Doctoral" : "Master's"}{" "}
              retention cutoff: {summary.retentionGwaThreshold.toFixed(2)} or
              better
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CurriculumGroupsList({
  groups,
  mode,
  onEditCourse,
}: {
  groups: CurriculumChecklistGroup[];
  mode: "STUDENT" | "ADMIN";
  onEditCourse: (group: CurriculumChecklistGroup, course: CurriculumChecklistCourse) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <Card key={group.id} className="border-gray-200/80 shadow-xs">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-[#262220]">
                    {group.label}
                  </h2>
                  {!group.countsTowardWce ? (
                    <Badge
                      variant="outline"
                      className="border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600"
                    >
                      Research / Defense Stage
                    </Badge>
                  ) : null}
                </div>
                {group.selectionNote ? (
                  <p className="text-xs font-medium text-[#8b1a1a]">
                    {group.selectionNote}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    group.isComplete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-700",
                  )}
                >
                  {group.earnedUnitsEffective} / {group.requiredUnits} units
                  {group.isComplete ? " · Complete" : ""}
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="w-[115px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Code
                    </TableHead>
                    <TableHead className="min-w-[220px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Subject
                    </TableHead>
                    <TableHead className="w-[70px] text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Units
                    </TableHead>
                    <TableHead className="w-[130px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Status
                    </TableHead>
                    <TableHead className="w-[80px] text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Rating
                    </TableHead>
                    <TableHead className="w-[140px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Term / S.Y.
                    </TableHead>
                    <TableHead className="w-[135px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Record Source
                    </TableHead>
                    <TableHead className="w-[95px] text-right text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.courses.map((course) => {
                    const p = course.progress;
                    const lockedForStudent =
                      mode === "STUDENT" && p.isVerifiedByAdmin;
                    const termLabel = [p.semester, p.schoolYear]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <TableRow
                        key={course.id}
                        className="border-gray-100 align-top"
                      >
                        <TableCell className="font-mono text-xs font-semibold text-[#262220]">
                          {course.courseCode}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-[#262220]">
                              {course.courseTitle}
                            </p>
                            {!course.isRequired ? (
                              <p className="text-[11px] text-gray-500">
                                Elective option
                              </p>
                            ) : null}
                            {course.prerequisiteNote ? (
                              <p className="text-[11px] text-amber-800">
                                {course.prerequisiteNote}
                              </p>
                            ) : null}
                            {p.remarks ? (
                              <p className="text-[11px] text-gray-500">
                                Note: {p.remarks}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-700">
                          {course.units}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] font-medium",
                              COURSE_STATUS_TONE[p.status] ??
                                "border-gray-200 text-gray-700",
                            )}
                          >
                            {COURSE_STATUS_LABEL[p.status] ?? p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm font-medium text-[#262220]">
                          {p.rating ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {termLabel || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.isVerifiedByAdmin ? (
                            <div className="space-y-0.5">
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700"
                              >
                                Verified
                              </Badge>
                              {p.verifiedByName ? (
                                <p className="text-[11px] text-gray-500">
                                  {p.verifiedByName}
                                </p>
                              ) : null}
                            </div>
                          ) : p.status !== "NOT_TAKEN" ? (
                            <span className="text-gray-500">
                              {p.encodedByRole === "ADMIN"
                                ? "Admin-encoded"
                                : "Self-reported"}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {lockedForStudent ? (
                            <span className="text-xs font-medium text-gray-400">
                              Locked
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onEditCourse(group, course)}
                            >
                              {mode === "ADMIN"
                                ? p.isVerifiedByAdmin
                                  ? "Edit"
                                  : "Edit / Verify"
                                : p.status === "NOT_TAKEN"
                                  ? "Encode"
                                  : "Update"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function GraduationRequirementsCard({
  checklist,
  mode,
  onEditPublication,
}: {
  checklist: StudentCurriculumChecklistDto;
  mode: "STUDENT" | "ADMIN";
  onEditPublication: () => void;
}) {
  const { comprehensiveExam, thesisOrDissertation, publication } =
    checklist.graduationRequirements;

  const compBadgeTone =
    comprehensiveExam.status === "PASSED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : comprehensiveExam.status === "DISMISSED"
        ? "border-red-200 bg-red-50 text-red-700"
        : comprehensiveExam.status === "RETAKE_REQUIRED" ||
            comprehensiveExam.status === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-gray-200 bg-gray-50 text-gray-600";

  const thesisBadgeTone =
    thesisOrDissertation.status === "PASSED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : thesisOrDissertation.status === "IN_PROGRESS"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-gray-200 bg-gray-50 text-gray-600";

  const canStudentEditPub = mode === "STUDENT" && !publication.isVerified;

  return (
    <Card className="border-gray-200/80 shadow-xs">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="border-b border-gray-100 pb-3.5">
          <h2 className="text-base font-semibold text-[#262220]">
            Requirements for Graduation (Manual §7.25)
          </h2>
          <p className="text-xs text-gray-500">
            Comprehensive Examination and Thesis/Dissertation status sync
            automatically from official Graduate School records.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200/80 bg-gray-50/40 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  1. Comprehensive Exam
                </p>
                <Badge
                  variant="outline"
                  className={cn("font-medium", compBadgeTone)}
                >
                  {comprehensiveExam.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-600">
                Attempts recorded: {comprehensiveExam.attemptsUsed} /{" "}
                {comprehensiveExam.maxAttempts}
                {comprehensiveExam.passedAt
                  ? ` · Passed ${formatShortDate(comprehensiveExam.passedAt)}`
                  : ""}
              </p>
            </div>
            {mode === "STUDENT" ? (
              <Link
                href="/student/journey"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-fit",
                )}
              >
                View Academic Journey
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200/80 bg-gray-50/40 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  2. {thesisOrDissertation.requirementName}
                </p>
                <Badge
                  variant="outline"
                  className={cn("font-medium", thesisBadgeTone)}
                >
                  {thesisOrDissertation.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-600">
                Tracked via Title, Proposal, and Final Oral Defense workflows.
              </p>
            </div>
            <Link
              href={
                mode === "STUDENT"
                  ? "/student/journey"
                  : "/admin/thesis/defense-records"
              }
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-fit",
              )}
            >
              {mode === "STUDENT" ? "Open Thesis Journey" : "Defense Records"}
            </Link>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200/80 bg-gray-50/40 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  3. Research Publication
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    PUBLICATION_STATUS_TONE[publication.status],
                  )}
                >
                  {PUBLICATION_STATUS_LABEL[publication.status]}
                </Badge>
              </div>
              <p className="text-xs text-gray-600">
                {publication.requirementDescription}
              </p>
              {publication.title ? (
                <div className="rounded border border-gray-200 bg-white px-2.5 py-2 text-xs">
                  <p className="font-medium text-[#262220]">
                    {publication.title}
                  </p>
                  {publication.venue || publication.year ? (
                    <p className="text-gray-500">
                      {[publication.venue, publication.year]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {publication.url ? (
                    <a
                      href={publication.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8b1a1a] underline"
                    >
                      Reference link
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            {mode === "ADMIN" || canStudentEditPub ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={onEditPublication}
              >
                {mode === "ADMIN"
                  ? "Update / Verify Publication"
                  : "Update Publication"}
              </Button>
            ) : (
              <p className="text-[11px] font-medium text-emerald-700">
                Verified by{" "}
                {publication.verifiedByName || "Graduate School Office"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
