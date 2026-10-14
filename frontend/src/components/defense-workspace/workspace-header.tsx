"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DefenseWorkspace } from "@/types/defense-workspace";

function formatWallDate(ymd: string | null): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function formatWallTime(hms: string | null): string {
  if (!hms) return "—";
  const m = /^(\d{1,2}):(\d{2})/.exec(hms);
  if (!m) return hms;
  const h = Number(m[1]);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${ampm}`;
}

function defenseLabel(t: string): string {
  if (t === "TITLE_DEFENSE") return "Title Defense";
  if (t === "PROPOSAL_DEFENSE") return "Proposal Defense";
  return "Final Defense";
}

function sessionLabel(s: string): string {
  switch (s) {
    case "SCHEDULED":
      return "Scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting formal conclusion";
    case "CONCLUDED":
      return "Concluded";
    case "CANCELLED":
      return "Cancelled";
    default:
      return s;
  }
}

export function DefenseWorkspaceHeader({
  workspace,
}: {
  workspace: DefenseWorkspace;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-(--earist-primary)">
              Defense Workspace
            </h1>
            <p className="text-sm text-(--earist-body-text)">
              {workspace.student.name}
              {workspace.student.studentNumber
                ? ` · ${workspace.student.studentNumber}`
                : ""}
              {workspace.student.program ? ` · ${workspace.student.program}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-(--earist-primary) text-white">
              {defenseLabel(workspace.schedule.defenseType)}
            </Badge>
            <Badge variant="outline">
              Your role: {workspace.myAssignment.role}
            </Badge>
            <Badge className="bg-amber-100 text-amber-800">
              {sessionLabel(workspace.schedule.sessionStatus)}
            </Badge>
          </div>
        </div>
        <div className="grid gap-1 text-xs text-(--earist-body-text) sm:grid-cols-3">
          <p>
            <span className="font-medium">Date:</span>{" "}
            {formatWallDate(workspace.schedule.defenseDate)}
          </p>
          <p>
            <span className="font-medium">Time:</span>{" "}
            {formatWallTime(workspace.schedule.defenseTime)}
          </p>
          <p>
            <span className="font-medium">Venue / Link:</span>{" "}
            {workspace.schedule.venueOrLink || "To be announced"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
