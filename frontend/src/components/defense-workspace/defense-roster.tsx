"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DefenseWorkspace } from "@/types/defense-workspace";

function statusLabel(s: string): string {
  switch (s) {
    case "NOT_STARTED":
      return "Not started";
    case "DRAFT":
      return "Draft";
    case "FINALIZED":
      return "Finalized";
    default:
      return "No evaluation required";
  }
}

export function DefenseRoster({
  roster,
}: {
  roster: DefenseWorkspace["roster"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Committee roster</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {roster.map((p) => (
          <div
            key={p.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--earist-border-gray) px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-(--earist-primary)">{p.name}</p>
              <p className="text-xs text-(--earist-body-text)">{p.role}</p>
            </div>
            <Badge
              variant="outline"
              className={
                p.evaluationStatus === "FINALIZED"
                  ? "border-emerald-300 text-emerald-700"
                  : p.evaluationStatus === "DRAFT"
                    ? "border-amber-300 text-amber-700"
                    : "text-(--earist-body-text)"
              }
            >
              {statusLabel(p.evaluationStatus)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
