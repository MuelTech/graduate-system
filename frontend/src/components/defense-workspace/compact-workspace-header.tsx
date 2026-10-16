"use client";

/**
 * CDW-4 — compact immersive workspace header.
 *
 * Dense but readable faculty-facing context: back link, student identity,
 * stage/attempt, schedule, session status, and the caller's functional role.
 * Global rail controls are supplied by the shell via `children`.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DefenseWorkspace } from "@/types/defense-workspace";

function formatWallDate(ymd: string | null): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

const DEFENSE_LABELS: Record<string, string> = {
  TITLE_DEFENSE: "Title Defense",
  PROPOSAL_DEFENSE: "Proposal Defense",
  FINAL_DEFENSE: "Final Defense",
};

const SESSION_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  AWAITING_CONCLUSION: "Awaiting conclusion",
  CONCLUDED: "Concluded",
  CANCELLED: "Cancelled",
  UNSCHEDULED: "Unscheduled",
};

export function CompactWorkspaceHeader({
  workspace,
  children,
}: {
  workspace: DefenseWorkspace;
  children?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--earist-border-gray) bg-white px-3 py-2">
      <Link
        href="/panelist/defenses"
        className="inline-flex items-center gap-1 text-[14px] font-medium text-(--earist-primary) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        My Defenses
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <GraduationCap className="h-5 w-5 shrink-0 text-(--earist-primary)" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-(--earist-primary)">
            {workspace.student.name}
            {workspace.student.studentNumber ? ` · ${workspace.student.studentNumber}` : ""}
          </p>
          <p className="truncate text-[13px] text-(--earist-body-text)">
            {workspace.student.program ?? "—"} · {DEFENSE_LABELS[workspace.schedule.defenseType] ?? workspace.schedule.defenseType}
            {" · "}
            {formatWallDate(workspace.schedule.defenseDate)} {formatWallTime(workspace.schedule.defenseTime)}
            {workspace.schedule.venueOrLink ? ` · ${workspace.schedule.venueOrLink}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="bg-(--earist-primary) text-white">
          {DEFENSE_LABELS[workspace.schedule.defenseType] ?? workspace.schedule.defenseType}
        </Badge>
        <Badge variant="outline">Role: {workspace.myAssignment.role}</Badge>
        <Badge className="bg-amber-100 text-amber-800">
          {SESSION_LABELS[workspace.schedule.sessionStatus] ?? workspace.schedule.sessionStatus}
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </header>
  );
}
