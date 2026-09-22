"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  CalendarClock,
  CheckCircle2,
  Users,
  MapPin,
  Clock3,
} from "lucide-react";
import type { ApprovedApplicationDto } from "@/types";
import {
  STAGE_LABELS,
  STATUS_LABELS,
  requirementLabel,
  sessionStatusLabel,
  committeeLine,
  formatDefenseDate,
  formatDefenseTime,
} from "./labels";

export type DefenseApplicationDto = ApprovedApplicationDto & {
  rejectionReason?: string | null;
  thesisDocuments: Array<{ id: string; docType: string; filePath: string }>;
};

type Props = {
  app: DefenseApplicationDto;
  onView: () => void;
  onAssignSchedule: () => void;
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "APPROVED":
      return "bg-green-100 text-green-800";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-800";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "PASSED":
      return "bg-emerald-100 text-emerald-800";
    case "REVISION":
      return "bg-orange-100 text-orange-800";
    case "FAILED":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function sessionStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "SCHEDULED":
    case "RESCHEDULED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-violet-100 text-violet-800";
    case "AWAITING_CONCLUSION":
      return "bg-amber-100 text-amber-800";
    case "CONCLUDED":
      return "bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function DefenseApplicationCard({
  app,
  onView,
  onAssignSchedule,
}: Props) {
  const student = app.student;
  const isTitle = app.stage === "TITLE";
  const isProposal = app.stage === "PROPOSAL";
  const isFinal = app.stage === "FINAL";
  const selectedTitle = app.thesisTitles.find((t) => t.isSelected) ?? null;
  const docCount = app.thesisDocuments?.length ?? 0;
  const adviser = app.assignment?.adviser;
  const session = app.currentSchedule ?? null;
  const committee = session?.committeeSummary;
  const committeeLines = committee
    ? [
        committeeLine("Chairman", committee.chairman),
        committeeLine("Panelists", committee.panelists),
        committeeLine("Facilitator", committee.facilitator),
        committeeLine("Rapporteur", committee.rapporteur),
        committeeLine("Adviser", committee.adviser),
      ].filter(Boolean)
    : [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-(--earist-primary)">
                {student.user.firstName} {student.user.lastName}
              </p>
              <Badge className={statusBadgeClass(app.status)}>
                {STATUS_LABELS[app.status] ?? app.status}
              </Badge>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {student.studentNumber || student.user.email} ·{" "}
              {student.program?.programName || "Program N/A"}
            </p>
            <p className="text-sm text-(--earist-body-text)">
              {STAGE_LABELS[app.stage]} · Submitted{" "}
              {new Date(app.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <Button size="sm" variant="outline" onClick={onView}>
              <Eye className="mr-1 h-3 w-3" />
              {app.status === "SCHEDULED"
                ? "View Defense Details"
                : "View Application"}
            </Button>
            {app.status === "APPROVED" && (
              <Button
                size="sm"
                onClick={onAssignSchedule}
                className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <CalendarClock className="mr-1 h-3 w-3" />
                Assign Panel &amp; Schedule
              </Button>
            )}
          </div>
        </div>

        {session && (
          <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/40 p-3 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-(--earist-secondary)">
                Defense Session
              </p>
              <Badge className={sessionStatusBadgeClass(session.sessionStatus)}>
                {sessionStatusLabel(session.sessionStatus)}
              </Badge>
            </div>
            <div className="grid gap-1 text-(--earist-body-text) sm:grid-cols-2">
              <p className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {formatDefenseDate(session.defenseDate)} ·{" "}
                {formatDefenseTime(session.defenseTime)}
              </p>
              <p className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {session.venueOrLink || "Venue / link not set"}
                </span>
              </p>
            </div>
            <div className="mt-2 border-t border-blue-100 pt-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
                <Users className="h-3.5 w-3.5" />
                Committee
              </p>
              {committeeLines.length === 0 ? (
                <p className="text-xs text-(--earist-body-text)">
                  No participants assigned yet.
                </p>
              ) : (
                <ul className="space-y-0.5 text-xs text-(--earist-body-text)">
                  {committeeLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}


        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-(--earist-border-gray) pt-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-(--earist-secondary)">
              Requirements
            </p>
            <p className="text-(--earist-body-text)">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-600" />
              {docCount} requirement{docCount === 1 ? "" : "s"} submitted
            </p>
            {docCount > 0 && (
              <p className="mt-1 truncate text-xs text-(--earist-body-text)">
                {app.thesisDocuments
                  .slice(0, 3)
                  .map((d) => requirementLabel(d.docType))
                  .join(" · ")}
                {docCount > 3 ? " …" : ""}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-(--earist-secondary)">
              Research Details
            </p>
            {isTitle && (
              <p className="text-(--earist-body-text)">
                {app.thesisTitles.length} proposed titles (all still proposals)
              </p>
            )}
            {(isProposal || isFinal) && (
              <p className="text-(--earist-body-text)">
                {selectedTitle
                  ? selectedTitle.titleText
                  : "Official approved research title not selected yet"}
              </p>
            )}
            {isTitle ? null : (
              <p className="mt-1 text-xs text-(--earist-body-text)">
                Adviser relationship:{" "}
                {adviser
                  ? `${adviser.firstName} ${adviser.lastName}`
                  : "Not assigned"}
                {session && !(committee?.adviser?.length ?? 0)
                  ? " (not a defense seat)"
                  : ""}
              </p>
            )}
          </div>
        </div>

        {app.status === "REJECTED" && app.rejectionReason && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            Rejection reason: {app.rejectionReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
