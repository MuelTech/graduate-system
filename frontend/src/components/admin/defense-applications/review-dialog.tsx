"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import type { DefenseDocumentHistory } from "@/types/defense-document-history";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Users,
  MapPin,
  Clock3,
  CalendarDays,
  History,
  ShieldCheck,
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

const MANUSCRIPT_STATUS_LABEL: Record<string, string> = {
  NONE: "No Adviser review yet",
  AWAITING_REVIEW: "Awaiting Adviser Review",
  CHANGES_REQUESTED: "Changes Requested",
  ISSUED: "Certified by Adviser",
};

const TIMELINE_LABEL: Record<string, string> = {
  DEFENSE_APPLICATION_REJECT: "Rejected",
  DEFENSE_APPLICATION_APPROVE: "Approved",
  DEFENSE_RESUBMIT: "Resubmitted",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function FilenameOrFallback({ name }: { name: string | null }) {
  return (
    <span className="min-w-0 break-words">{name || "Filename unavailable"}</span>
  );
}

/**
 * DL-8: workflow-aware, read-only document history for the open application.
 * Fetched only while the review dialog is open, and only for this thesis/stage.
 */
function DocumentHistorySection({
  thesisId,
  stage,
  onViewDocument,
  onOpenOfficialRecord,
}: {
  thesisId: string;
  stage: string;
  onViewDocument: (req: { fetchUrl: string; title: string }) => void;
  onOpenOfficialRecord: (scheduleId: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["defenseDocumentHistory", thesisId, stage],
    enabled: !!thesisId,
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/applications/${thesisId}/document-history?stage=${stage}`,
      )) as DefenseDocumentHistory,
  });

  if (isLoading) {
    return (
      <p className="text-xs text-(--earist-body-text)">
        Loading document history…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-xs text-red-600">Unable to load document history.</p>
    );
  }

  const view = (doc: { id: string }, title: string) =>
    onViewDocument({
      fetchUrl: `/api/documents/thesis-document/${doc.id}/file`,
      title,
    });

  return (
    <div className="mt-3 space-y-4 border-t border-(--earist-border-gray) pt-3">
      {data.reviewTimeline.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
            Review Timeline
          </p>
          <ul className="space-y-1 text-xs text-(--earist-body-text)">
            {data.reviewTimeline.map((e, i) => (
              <li
                key={`${e.type}-${i}`}
                className="rounded-md bg-(--earist-surface-gray) px-3 py-2"
              >
                <span className="font-medium text-(--earist-primary)">
                  {TIMELINE_LABEL[e.type] ?? e.type}
                </span>
                <span> · {formatDateTime(e.timestamp)}</span>
                {e.actor && <span> · {e.actor.name}</span>}
                {e.reason && <p className="mt-0.5">Reason: {e.reason}</p>}
                {e.replacementSummary && (
                  <p className="mt-0.5">
                    Previous reason:{" "}
                    {e.replacementSummary.previousRejectionReason || "—"}
                    {e.replacementSummary.replacements.length > 0 && (
                      <>
                        {" · "}
                        {e.replacementSummary.replacements
                          .map((r) =>
                            r.supersededDocumentId
                              ? `${r.docType} replaced`
                              : `${r.docType} added`,
                          )
                          .join(", ")}
                      </>
                    )}
                  </p>
                )}
                {!e.reason &&
                  !e.replacementSummary &&
                  e.description && <p className="mt-0.5">{e.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-(--earist-secondary)">
          Supporting Evidence
        </p>
        <ul className="space-y-1.5">
          {data.supportingEvidence.map((slot) => (
            <li
              key={slot.docType}
              className="rounded-md bg-(--earist-surface-gray) px-3 py-2"
            >
              <p className="text-xs font-medium">
                {requirementLabel(slot.docType)}
              </p>
              {slot.integrityState === "MISSING" && (
                <p className="text-xs text-amber-700">
                  No current document recorded.
                </p>
              )}
              {slot.integrityState === "AMBIGUOUS" && (
                <p className="text-xs text-amber-700">
                  Data warning: Multiple current versions recorded —
                  reconciliation required.
                </p>
              )}
              {slot.current && (
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <Badge variant="outline" className="mr-1">
                      Current
                    </Badge>
                    <FilenameOrFallback name={slot.current.originalFilename} />
                    <span className="ml-1 text-(--earist-body-text)">
                      · {formatDateTime(slot.current.uploadedAt)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      view(slot.current!, requirementLabel(slot.docType))
                    }
                  >
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
              )}
              {slot.history.map((h) => (
                <div
                  key={h.id}
                  className="mt-0.5 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0">
                    <Badge variant="outline" className="mr-1">
                      Previous version
                    </Badge>
                    <FilenameOrFallback name={h.originalFilename} />
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      view(
                        h,
                        `${requirementLabel(slot.docType)} (previous version)`,
                      )
                    }
                  >
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>

      {data.manuscriptReview && (
        <div className="rounded-md border border-(--earist-border-gray) p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-(--earist-secondary)">
            <ShieldCheck className="h-3.5 w-3.5" />
            Manuscript — Read-only (Adviser reviewed)
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">
              {MANUSCRIPT_STATUS_LABEL[data.manuscriptReview.certificationStatus] ??
                data.manuscriptReview.certificationStatus}
            </Badge>
            {data.manuscriptReview.adviser && (
              <span>Adviser: {data.manuscriptReview.adviser.name}</span>
            )}
          </p>
          {data.manuscriptReview.reviewRemarks && (
            <p className="mt-1 text-xs text-(--earist-body-text)">
              Remarks: {data.manuscriptReview.reviewRemarks}
            </p>
          )}
          {data.manuscriptReview.signedAt && (
            <p className="text-xs text-(--earist-body-text)">
              Issued: {formatDateTime(data.manuscriptReview.signedAt)}
            </p>
          )}
          {data.manuscriptReview.warning && (
            <p className="mt-1 text-xs text-amber-700">
              {data.manuscriptReview.warning}
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {data.manuscriptReview.versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0">
                  {v.isCertified && (
                    <Badge className="mr-1 bg-green-100 text-green-800">
                      Certified by Adviser
                    </Badge>
                  )}
                  {!v.isCertified && v.isReviewedByAdviser && (
                    <Badge variant="outline" className="mr-1">
                      Adviser review document
                    </Badge>
                  )}
                  <Badge variant="outline" className="mr-1">
                    {v.isVersionHead ? "Current version head" : "Previous version"}
                  </Badge>
                  <FilenameOrFallback name={v.originalFilename} />
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => view(v, "Manuscript version")}
                >
                  <Eye className="mr-1 h-3 w-3" /> View
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.officialRecord?.available && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onOpenOfficialRecord(data.officialRecord!.scheduleId)
          }
        >
          View Official Defense Record (read-only)
        </Button>
      )}
    </div>
  );
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
  const router = useRouter();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
              <div className="flex items-center justify-between">
                <SectionLabel>Requirements</SectionLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <History className="mr-1 h-3 w-3" />
                  {showHistory ? "Hide history" : "View history"}
                </Button>
              </div>
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
              {showHistory && (
                <DocumentHistorySection
                  thesisId={app.thesisId ?? app.id}
                  stage={app.stage}
                  onViewDocument={setViewerDoc}
                  onOpenOfficialRecord={(scheduleId) =>
                    router.push(`/admin/thesis/defense-records/${scheduleId}`)
                  }
                />
              )}
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
