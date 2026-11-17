"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApprovedApplicationDto } from "@/types";
import { defenseTypeLabel } from "./types";

type Props = {
  application: ApprovedApplicationDto;
};

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-(--earist-body-text)">{label}</p>
      <p className="text-sm break-words text-foreground">{value}</p>
    </div>
  );
}

export function DefenseSummaryCard({ application }: Props) {
  const student = application.student;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Selected Defense
          </CardTitle>
          <Badge variant="outline" className="text-(--earist-secondary)">
            {defenseTypeLabel(application.stage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
