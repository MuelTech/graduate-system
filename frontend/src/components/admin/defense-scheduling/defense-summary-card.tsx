"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApprovedApplicationDto } from "@/types";
import { defenseTypeLabel } from "./types";

type Props = {
  application: ApprovedApplicationDto;
};

export function DefenseSummaryCard({ application }: Props) {
  const student = application.student;
  const isTitle = application.stage === "TITLE";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base text-(--earist-primary)">
            Selected Defense
          </CardTitle>
          <Badge className="bg-purple-100 text-purple-700">
            {defenseTypeLabel(application.stage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-(--earist-body-text)">Student</p>
            <p className="font-semibold">
              {student.user.firstName} {student.user.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Student No.</p>
            <p>{student.studentNumber || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Program</p>
            <p>{student.program?.programName || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Application Approved</p>
            <p>{new Date(application.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {isTitle && application.thesisTitles.length > 0 && (
          <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
            <p className="text-xs font-semibold text-(--earist-secondary)">
              Proposed Titles
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-(--earist-body-text)">
              {application.thesisTitles.map((t) => (
                <li key={t.id}>{t.titleText}</li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-(--earist-body-text)">
              Winning title is selected at Title Defense conclusion — not here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
