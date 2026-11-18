"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovedApplicationDto } from "@/types";
import { defenseTypeLabel } from "./types";

type Props = {
  application: ApprovedApplicationDto;
};

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case "TITLE":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "PROPOSAL":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "FINAL":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-gray-200 bg-gray-50 text-[#333333]";
  }
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium break-words text-[#333333]">
        {value}
      </p>
    </div>
  );
}

export function DefenseSummaryCard({ application }: Props) {
  const student = application.student;

  return (
    <Card className="border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-bold text-[#333333]">
            Selected Defense
          </CardTitle>
          <Badge
            variant="outline"
            className={cn("font-medium", stageBadgeClass(application.stage))}
          >
            {defenseTypeLabel(application.stage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ContextItem
          label="Student"
          value={`${student.user.firstName} ${student.user.lastName}`}
        />
        <ContextItem
          label="Student No."
          value={student.studentNumber || "Not recorded"}
        />
        <ContextItem
          label="Program"
          value={student.program?.programName || "Not recorded"}
        />
        <ContextItem
          label="Defense Stage"
          value={defenseTypeLabel(application.stage)}
        />
      </CardContent>
    </Card>
  );
}
