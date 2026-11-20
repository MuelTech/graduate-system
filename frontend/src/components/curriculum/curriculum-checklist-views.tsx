"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COURSE_STATUS_LABEL, COURSE_STATUS_TONE } from "@/lib/curriculum";
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
        <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="space-y-1.5 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Assigned Curriculum
            </p>
            <p className="text-sm font-semibold text-[#262220]">
              {curriculumVersion.label}
            </p>
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Total Units
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
              {summary.totalInProgressUnits > 0
                ? ` · ${summary.totalInProgressUnits} in progress`
                : ""}
            </p>
          </div>

          <div className="space-y-1.5 p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              General Weighted Average (GWA)
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
  onEditCourse,
}: {
  groups: CurriculumChecklistGroup[];
  onEditCourse: (
    group: CurriculumChecklistGroup,
    course: CurriculumChecklistCourse,
  ) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <Card key={group.id} className="border-gray-200/80 shadow-xs">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold text-[#262220]">
                  {group.label}
                </h2>
                {group.selectionNote ? (
                  <p className="text-xs font-medium text-[#8b1a1a]">
                    {group.selectionNote}
                  </p>
                ) : null}
              </div>

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

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="w-[120px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Code
                    </TableHead>
                    <TableHead className="min-w-[240px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
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
                    <TableHead className="w-[150px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Term / S.Y.
                    </TableHead>
                    <TableHead className="w-[95px] text-right text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.courses.map((course) => {
                    const p = course.progress;
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
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onEditCourse(group, course)}
                          >
                            {p.status === "NOT_TAKEN" ? "Encode" : "Update"}
                          </Button>
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

export function CurriculumGraduationSummaryCard({
  checklist,
}: {
  checklist: StudentCurriculumChecklistDto;
}) {
  const { groups, summary, student } = checklist;
  if (!summary) return null;

  const isDoctoral = student.programType === "DOCTORAL";
  const requirements = isDoctoral
    ? [
        "Passing the Comprehensive Examination",
        "Publicly defended Dissertation",
        "Publication in a nationally/internationally indexed journal or juried creative work outlet",
      ]
    : [
        "Passing the Comprehensive Examination",
        "Thesis",
        "At least one (1) publication in a refereed journal or juried creative work",
      ];

  return (
    <Card className="border-gray-200/80 shadow-xs">
      <CardContent className="grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2 md:divide-x md:divide-gray-100">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Required Units for Graduation
          </h2>
          <dl className="divide-y divide-gray-100 text-sm">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between py-1.5"
              >
                <dt className="text-gray-700">{group.label}</dt>
                <dd className="font-medium text-[#262220]">
                  {group.requiredUnits} units
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2.5 font-semibold text-[#262220]">
              <dt>Total</dt>
              <dd>{summary.totalRequiredUnits} units</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 md:pl-6">
          <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Requirements for Graduation
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
