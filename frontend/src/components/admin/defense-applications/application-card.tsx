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
  requirementLabel,
  sessionStatusLabel,
  compactNameList,
  parseVenueOrLink,
  canShowAssignSchedule,
  canShowSessionPanel,
  displayStatusKey,
  displayStatusLabel,
  viewButtonLabel,
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

function VenueLine({
  value,
  emptyText = "Venue / link not set",
}: {
  value?: string | null;
  emptyText?: string;
}) {
  const venue = parseVenueOrLink(value);
  if (venue.kind === "empty") {
    return <span className="text-(--earist-body-text)">{emptyText}</span>;
  }
  if (venue.kind === "url") {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="truncate">{venue.label}</span>
        <a
          href={venue.href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-(--earist-secondary) underline underline-offset-2"
        >
          Open meeting link
        </a>
      </span>
    );
  }
  return (
    <span className="break-words text-(--earist-body-text)">{venue.text}</span>
  );
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
  const workflowBucket = app.workflowBucket;
  const session = app.currentSchedule ?? null;
  // Session/committee only when the backend bucket says Active (or History detail).
  // Ready must never show a current-stage committee alongside Assign Panel & Schedule.
  const showSession = canShowSessionPanel(workflowBucket, !!session);
  const showAssign = canShowAssignSchedule(workflowBucket);
  const committee = showSession ? session?.committeeSummary : undefined;
  const hasCommitteeNames = !!committee && (
    committee.chairman.length > 0 ||
    committee.panelists.length > 0 ||
    committee.facilitator.length > 0 ||
    committee.rapporteur.length > 0 ||
    committee.adviser.length > 0
  );
  const hasAdviserSeat = (committee?.adviser?.length ?? 0) > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-(--earist-primary)">
                {student.user.firstName} {student.user.lastName}
              </p>
              <Badge className={statusBadgeClass(displayStatusKey(app))}>
                {displayStatusLabel(app)}
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
              {viewButtonLabel(app.status, workflowBucket)}
            </Button>
            {showAssign && (
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

        {showSession && session && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-blue-100 bg-blue-50/40 p-3 text-sm lg:grid-cols-2">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Defense Session
                </p>
                <Badge className={sessionStatusBadgeClass(session.sessionStatus)}>
                  {sessionStatusLabel(session.sessionStatus)}
                </Badge>
              </div>
              <div className="space-y-1 text-(--earist-body-text)">
                <p className="flex items-start gap-1">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {formatDefenseDate(session.defenseDate)} ·{" "}
                    {formatDefenseTime(session.defenseTime)}
                  </span>
                </p>
                <p className="flex min-w-0 items-start gap-1">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    <VenueLine value={session.venueOrLink} />
                  </span>
                </p>
              </div>
            </div>

            <div className="min-w-0 lg:border-l lg:border-blue-100 lg:pl-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
                <Users className="h-3.5 w-3.5" />
                Committee
              </p>
              {!hasCommitteeNames ? (
                <p className="text-xs text-(--earist-body-text)">
                  No participants recorded for this session.
                </p>
              ) : (
                <dl className="space-y-1 text-xs text-(--earist-body-text)">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-medium text-(--earist-secondary)">
                      Chairman
                    </dt>
                    <dd className="min-w-0 break-words">
                      {compactNameList(committee.chairman)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-medium text-(--earist-secondary)">
                      Panelists
                    </dt>
                    <dd className="min-w-0 break-words">
                      {compactNameList(committee.panelists)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-medium text-(--earist-secondary)">
                      Facilitator
                    </dt>
                    <dd className="min-w-0 break-words">
                      {compactNameList(committee.facilitator)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-medium text-(--earist-secondary)">
                      Rapporteur
                    </dt>
                    <dd className="min-w-0 break-words">
                      {compactNameList(committee.rapporteur)}
                    </dd>
                  </div>
                  {hasAdviserSeat && (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 font-medium text-(--earist-secondary)">
                        Adviser
                      </dt>
                      <dd className="min-w-0 break-words">
                        {compactNameList(committee.adviser)}
                      </dd>
                    </div>
                  )}
                </dl>
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
            {(isProposal || isFinal) && adviser && (
              <p className="mt-1 text-xs text-(--earist-body-text)">
                Adviser: {adviser.firstName} {adviser.lastName}
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
