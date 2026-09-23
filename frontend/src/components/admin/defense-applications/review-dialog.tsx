"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Users,
  MapPin,
  Clock3,
  CalendarDays,
} from "lucide-react";
import { DocumentViewer } from "@/components/ui/document-viewer";
import {
  STAGE_LABELS,
  STATUS_LABELS,
  requirementLabel,
  sessionStatusLabel,
  dialogTitleForStatus,
  parseVenueOrLink,
  canShowSessionPanel,
  formatDefenseDate,
  formatDefenseTime,
} from "./labels";
import type { DefenseApplicationDto } from "./application-card";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: DefenseApplicationDto | null;
  onApprove: (thesisId: string) => void;
  onReject: (thesisId: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
};

function SectionLabel({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
      {icon}
      {children}
    </p>
  );
}

function RoleList({
  label,
  names,
}: {
  label: string;
  names: string[];
}) {
  if (!names.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-(--earist-secondary)">{label}</p>
      <ul className="mt-0.5 space-y-0.5 text-(--earist-body-text)">
        {names.map((name) => (
          <li key={`${label}-${name}`} className="break-words">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VenueDisplay({ value }: { value?: string | null }) {
  const venue = parseVenueOrLink(value);
  if (venue.kind === "empty") {
    return <span>Not set</span>;
  }
  if (venue.kind === "url") {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span>{venue.label}</span>
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
  return <span className="break-words">{venue.text}</span>;
}

export function DefenseApplicationReviewDialog({
  open,
  onOpenChange,
  app,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: Props) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{
    fetchUrl: string;
    title: string;
  } | null>(null);

  if (!app) return null;
  const student = app.student;
  const isTitle = app.stage === "TITLE";
  const isProposal = app.stage === "PROPOSAL";
  const isFinal = app.stage === "FINAL";
  const selectedTitle = app.thesisTitles.find((t) => t.isSelected) ?? null;
  const adviser = app.assignment?.adviser;
  const canDecide = app.status === "PENDING";
  const session = app.currentSchedule ?? null;
  const showSession = canShowSessionPanel(app.workflowBucket, !!session);
  const committee = showSession ? session?.committeeSummary : undefined;
  const hasAdviserSeat = (committee?.adviser?.length ?? 0) > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogTitleForStatus(app.status)}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            {/* Student / Defense summary */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Student
                </p>
                <p className="font-semibold">
                  {student.user.firstName} {student.user.lastName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {student.studentNumber || student.user.email}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {student.program?.programName || "N/A"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Defense
                </p>
                <p className="font-semibold">{STAGE_LABELS[app.stage]}</p>
                <p className="text-xs text-(--earist-body-text)">
                  Submitted {new Date(app.createdAt).toLocaleDateString()}
                </p>
                <Badge className="mt-1">
                  {STATUS_LABELS[app.status] ?? app.status}
                </Badge>
              </div>
            </div>

            {/* Defense Session */}
            {showSession && session && (
              <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <SectionLabel
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                  >
                    Defense Session
                  </SectionLabel>
                  <Badge variant="outline">
                    {sessionStatusLabel(session.sessionStatus)}
                  </Badge>
                </div>
                <ul className="space-y-1.5 text-(--earist-body-text)">
                  <li className="flex items-start gap-1.5">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-medium">Date: </span>
                      {formatDefenseDate(session.defenseDate)}
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-medium">Time: </span>
                      {formatDefenseTime(session.defenseTime)}
                    </span>
                  </li>
                  <li className="flex min-w-0 items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-medium">Venue / Teams: </span>
                      <VenueDisplay value={session.venueOrLink} />
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {/* Assigned Committee — full names by role */}
            {showSession && session && (
              <div>
                <SectionLabel icon={<Users className="h-3.5 w-3.5" />}>
                  Assigned Committee
                </SectionLabel>
                {!committee ||
                (!committee.chairman.length &&
                  !committee.panelists.length &&
                  !committee.facilitator.length &&
                  !committee.rapporteur.length &&
                  !committee.adviser.length) ? (
                  <p className="text-(--earist-body-text)">
                    No participants recorded for this session.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 rounded-md bg-(--earist-surface-gray) p-3 sm:grid-cols-2">
                    <RoleList label="Chairman" names={committee.chairman} />
                    <RoleList label="Panelists" names={committee.panelists} />
                    <RoleList
                      label="Facilitator"
                      names={committee.facilitator}
                    />
                    <RoleList
                      label="Rapporteur"
                      names={committee.rapporteur}
                    />
                    {hasAdviserSeat && (
                      <RoleList label="Adviser" names={committee.adviser} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Requirements */}
            <div>
              <SectionLabel>Requirements</SectionLabel>
              <ul className="space-y-1">
                {(app.thesisDocuments ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-(--earist-surface-gray) px-3 py-2"
                  >
                    <span className="min-w-0 break-words">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-600" />
                      {requirementLabel(d.docType)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`View ${requirementLabel(d.docType)}`}
                      onClick={() =>
                        setViewerDoc({
                          fetchUrl: `/api/documents/thesis-document/${d.id}/file`,
                          title: requirementLabel(d.docType),
                        })
                      }
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                  </li>
                ))}
                {(app.thesisDocuments ?? []).length === 0 && (
                  <li className="text-(--earist-body-text)">
                    No documents uploaded yet.
                  </li>
                )}
              </ul>
            </div>

            {/* Research Details */}
            <div>
              <SectionLabel>Research Details</SectionLabel>
              {isTitle && (
                <div>
                  <p className="text-xs font-medium text-(--earist-secondary)">
                    Proposed Research Titles (all remain proposals)
                  </p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {app.thesisTitles.map((t) => (
                      <li key={t.id} className="break-words">
                        {t.titleText}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[11px] text-(--earist-body-text)">
                    Winning title is selected only at Title Defense conclusion.
                    Application approval does not select a title.
                  </p>
                </div>
              )}

              {(isProposal || isFinal) && (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-(--earist-secondary)">
                      Official Approved Research Title
                    </p>
                    <p className="break-words">
                      {selectedTitle?.titleText || "Not selected yet"}
                    </p>
                  </div>
                  {adviser && (
                    <div>
                      <p className="text-xs font-medium text-(--earist-secondary)">
                        Thesis Adviser (relationship)
                      </p>
                      <p className="break-words">
                        {adviser.firstName} {adviser.lastName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isFinal && (
                <p className="mt-2 text-xs text-(--earist-body-text)">
                  Final Defense covers the complete manuscript. Rapporteur Report
                  is only created after the defense is conducted and formally
                  concluded.
                </p>
              )}
            </div>

            {app.status === "REJECTED" && app.rejectionReason && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs break-words text-red-700">
                Rejection reason: {app.rejectionReason}
              </p>
            )}

            {canDecide && (
              <div className="border-t border-(--earist-border-gray) pt-3">
                <p className="mb-2 text-xs font-semibold text-(--earist-secondary)">
                  Admin Decision
                </p>
                {!showReject ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={() => setShowReject(true)}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Reject Application
                    </Button>
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      disabled={isApproving}
                      onClick={() => onApprove(app.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {isApproving ? "Approving..." : "Approve Application"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      className="text-xs font-medium text-(--earist-secondary)"
                      htmlFor="reject-reason"
                    >
                      Reason for rejection *
                    </label>
                    <textarea
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
                      placeholder="Explain what must be corrected..."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReject(false);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-red-600 text-white hover:bg-red-700"
                        disabled={!rejectReason.trim() || isRejecting}
                        onClick={() => onReject(app.id, rejectReason.trim())}
                      >
                        {isRejecting ? "Rejecting..." : "Reject Application"}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-(--earist-body-text)">
                  Approve this defense application? The application will become
                  ready for panel assignment and scheduling. This does not select
                  a title or mark the defense as passed.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewerDoc && (
        <DocumentViewer
          open={!!viewerDoc}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          fetchUrl={viewerDoc.fetchUrl}
          title={viewerDoc.title}
        />
      )}
    </>
  );
}
