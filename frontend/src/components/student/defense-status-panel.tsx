"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Info,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { resolveDefenseVenue } from "@/lib/student-dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import {
  defenseStatusDescription,
  defenseStatusHeading,
  formatDefenseDate,
  formatDefenseTime,
  sessionStatusLabel,
} from "@/lib/student-thesis-journey";
import type {
  DefenseSessionSummary,
  DefenseSubstatus,
  JourneyStepView,
} from "@/types/student-thesis-journey";
import { StudentRapPanel } from "@/components/student/student-rap-panel";
import { StudentOfficialApplicationRecord } from "@/components/student/official-defense-application-record";

interface CurrentEvidenceDto {
  id: string;
  docType: string;
  defenseStage: string | null;
  originalFilename: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  isCurrent: boolean;
}

interface CurrentApplicationDto {
  thesisId: string;
  stage: string;
  status: string;
  rejectionReason: string | null;
  evidence: CurrentEvidenceDto[];
}

type DefenseKind = "Title" | "Proposal" | "Final";
type StageCode = "TITLE" | "PROPOSAL" | "FINAL";

const STAGE_CODE_BY_KIND: Record<DefenseKind, StageCode> = {
  Title: "TITLE",
  Proposal: "PROPOSAL",
  Final: "FINAL",
};

const STAGE_DOCUMENTS_BY_KIND: Record<
  DefenseKind,
  { docType: string; label: string }[]
> = {
  Title: [
    { docType: "TITLE_PROPOSAL", label: "Title Defense Proposal Package" },
    { docType: "COR", label: "Current Semester COR" },
    { docType: "RECEIPT", label: "Defense-fee Proof of Payment" },
  ],
  Proposal: [
    {
      docType: "PROPOSAL_CHAPTERS",
      label: "Adviser-Certified Proposal Manuscript (Chapters 1–3)",
    },
    { docType: "COR", label: "Current Semester COR" },
    { docType: "RECEIPT", label: "Defense-fee Proof of Payment" },
  ],
  Final: [
    {
      docType: "FINAL_MANUSCRIPT",
      label: "Adviser-Certified Final Manuscript",
    },
    { docType: "COR", label: "Current Semester COR" },
    { docType: "RECEIPT", label: "Defense-fee Proof of Payment" },
  ],
};

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Whole-HTTP(S)-URL => clickable meeting link; otherwise plain text. */
function VenueValue({ venueOrLink }: { venueOrLink: string | null | undefined }) {
  const venue = resolveDefenseVenue(venueOrLink);
  if (venue.kind === "none") {
    return <span className="text-gray-500">To be announced</span>;
  }
  if (venue.kind === "physical") {
    return (
      <span className="flex items-center gap-1.5 break-words font-semibold text-[#333333]">
        <MapPin className="h-4 w-4 shrink-0 text-[#e02b20]" />
        {venue.text}
      </span>
    );
  }
  return (
    <a
      href={venue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 break-all font-semibold text-[#91060c] hover:underline focus-visible:ring-2 focus-visible:ring-[#e02b20] focus-visible:outline-none"
    >
      <ExternalLink className="h-4 w-4 shrink-0 text-[#e02b20]" aria-hidden="true" />
      Open Meeting Link
    </a>
  );
}

function DocRow({
  label,
  doc,
  onView,
}: {
  label: string;
  doc: CurrentEvidenceDto | null;
  onView: (doc: CurrentEvidenceDto) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e02b20]/10">
          <FileText className="h-4 w-4 text-[#e02b20]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333333]">{label}</p>
          <p className="truncate text-xs text-gray-600">
            {doc ? doc.originalFilename || label : "Not yet available"}
          </p>
          {doc && (
            <p className="text-xs text-gray-500">
              {[
                formatBytes(doc.sizeBytes),
                `Submitted ${new Date(doc.uploadedAt).toLocaleDateString()}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
      {doc && (
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            On file
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onView(doc)}
            aria-label={`View ${label}`}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
          </Button>
        </div>
      )}
    </div>
  );
}

type MiniStepState = "completed" | "active" | "pending";

interface MiniStep {
  stepNumber: number;
  label: string;
  sublabel: string;
  state: MiniStepState;
}

function buildMiniSteps(
  status: DefenseSubstatus | null | undefined,
  kind: DefenseKind,
): {
  badgeLabel: string;
  badgeClass: string;
  handledBy: string;
  guidanceText: string;
  steps: MiniStep[];
} {
  switch (status) {
    case "APPLICATION_UNDER_REVIEW":
      return {
        badgeLabel: "Under Graduate School Review",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
        handledBy: "Graduate School",
        guidanceText: `Your ${kind} Defense documents are currently being verified by the Graduate School. No action is required from you right now.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Under review",
            state: "active",
          },
          {
            stepNumber: 3,
            label: "Defense Schedule",
            sublabel: "Pending approval",
            state: "pending",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "After defense",
            state: "pending",
          },
        ],
      };
    case "APPROVED_WAITING_SCHEDULE":
      return {
        badgeLabel: "Approved — Waiting for Schedule",
        badgeClass: "border-blue-200 bg-blue-50 text-blue-800",
        handledBy: "Graduate School",
        guidanceText: `Your ${kind} Defense application has been approved. The Graduate School is preparing your defense schedule and committee assignment.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Approved",
            state: "completed",
          },
          {
            stepNumber: 3,
            label: "Defense Schedule",
            sublabel: "Assigning slot & panel",
            state: "active",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "After defense",
            state: "pending",
          },
        ],
      };
    case "SCHEDULED":
      return {
        badgeLabel: "Defense Scheduled",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
        handledBy: "Student & Defense Committee",
        guidanceText: `Your ${kind} Defense schedule is confirmed. Review your schedule details below and prepare to attend your defense session.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Approved",
            state: "completed",
          },
          {
            stepNumber: 3,
            label: "Defense Schedule",
            sublabel: "Scheduled — Ready",
            state: "active",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "After defense",
            state: "pending",
          },
        ],
      };
    case "DEFENSE_IN_PROGRESS":
      return {
        badgeLabel: "Defense in Progress",
        badgeClass: "border-[#e02b20]/30 bg-[#fff5f5] text-[#91060c]",
        handledBy: "Defense Committee",
        guidanceText: `Your ${kind} Defense session is currently underway with your assigned committee.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Approved",
            state: "completed",
          },
          {
            stepNumber: 3,
            label: "Defense Session",
            sublabel: "Live session underway",
            state: "active",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "Deliberation next",
            state: "pending",
          },
        ],
      };
    case "AWAITING_CONCLUSION":
      return {
        badgeLabel: "Awaiting Official Verdict",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
        handledBy: "Committee Chairman",
        guidanceText: `Your ${kind} Defense deliberation has finished. The Committee Chairman is recording the formal verdict and finalizing the Rapporteur Report.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Approved",
            state: "completed",
          },
          {
            stepNumber: 3,
            label: "Defense Session",
            sublabel: "Deliberation finished",
            state: "completed",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "Recording verdict",
            state: "active",
          },
        ],
      };
    case "FINALIZING_RECORDS":
      return {
        badgeLabel: "Passed — Finalizing Rapporteur Report",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
        handledBy: "Defense Committee",
        guidanceText: `Your ${kind} Defense formal result is Passed. The Rapporteur Report is being signed by the defense committee before the next stage unlocks.`,
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Documents on file",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "Approved",
            state: "completed",
          },
          {
            stepNumber: 3,
            label: "Defense Session",
            sublabel: "Passed",
            state: "completed",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "Finalizing signatures",
            state: "active",
          },
        ],
      };
    default:
      return {
        badgeLabel: defenseStatusHeading(status, "In Progress"),
        badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
        handledBy: "Graduate School",
        guidanceText: defenseStatusDescription(status, kind),
        steps: [
          {
            stepNumber: 1,
            label: "Application Submitted",
            sublabel: "Recorded",
            state: "completed",
          },
          {
            stepNumber: 2,
            label: "GS Verification",
            sublabel: "In progress",
            state: "active",
          },
          {
            stepNumber: 3,
            label: "Defense Schedule",
            sublabel: "Pending",
            state: "pending",
          },
          {
            stepNumber: 4,
            label: "Verdict & Report",
            sublabel: "Pending",
            state: "pending",
          },
        ],
      };
  }
}

export function DefenseScheduleSummary({
  session,
}: {
  session: DefenseSessionSummary | null | undefined;
}) {
  if (!session) return null;
  const isConcluded = session.sessionStatus === "CONCLUDED";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
              <CalendarDays className="h-4 w-4 text-[#e02b20]" />
              Defense Schedule
            </CardTitle>
            <Badge
              variant="outline"
              className={
                isConcluded
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }
            >
              {sessionStatusLabel(session.sessionStatus)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Date
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-[#333333]">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#e02b20]" />
                <span>{formatDefenseDate(session.defenseDate)}</span>
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Time
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-[#333333]">
                <Clock className="h-4 w-4 shrink-0 text-[#e02b20]" />
                <span>{formatDefenseTime(session.defenseTime)}</span>
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Venue / Meeting Details
              </p>
              <div className="mt-1 text-sm text-[#333333]">
                <VenueValue venueOrLink={session.venueOrLink} />
              </div>
            </div>
          </div>

          {session.scheduleId && !isConcluded && (
            <StudentOfficialApplicationRecord scheduleId={session.scheduleId} />
          )}
        </CardContent>
      </Card>

      {session.scheduleId && (
        <StudentRapPanel scheduleId={session.scheduleId} />
      )}
    </div>
  );
}

/**
 * Unified Student Defense Stage Status View (Title, Proposal, and Final Defense).
 * Provides:
 *  1. Smart Status Card + 4-Step Visual Stage Progress Tracker
 *  2. Defense Schedule & Official Defense Application PDF Card
 *  3. Stage-Aware Submitted Documents & Adviser Certification Card
 *  4. Committee Report (RAP) Panel
 */
export function DefenseStatusPanel({
  kind,
  step,
  onRefresh,
  isRefreshing,
  extra,
}: {
  kind: DefenseKind;
  step: JourneyStepView | undefined;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  extra?: React.ReactNode;
}) {
  const [viewerDoc, setViewerDoc] = useState<CurrentEvidenceDto | null>(null);
  const status: DefenseSubstatus | null | undefined = step?.defenseStatus;
  const heading = defenseStatusHeading(status, `${kind} Defense Application`);
  const stageCode = STAGE_CODE_BY_KIND[kind];
  const requiredDocs = STAGE_DOCUMENTS_BY_KIND[kind];
  const progress = buildMiniSteps(status, kind);

  const {
    data: application,
    isLoading: docsLoading,
    isError: docsError,
    refetch: refetchDocs,
  } = useQuery<CurrentApplicationDto | null>({
    queryKey: ["student", "thesis", "current-application", stageCode],
    queryFn: async () =>
      apiClientRequest(`/thesis/defense/current?stage=${stageCode}`),
  });

  const currentByType = new Map(
    (application?.evidence ?? [])
      .filter((e) => e.isCurrent)
      .map((e) => [e.docType, e]),
  );

  return (
    <div className="space-y-4">
      {/* Card 1: Smart Status Card + 4-Step Visual Mini-Tracker */}
      <Card>
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-bold text-[#333333]">
                  {heading}
                </CardTitle>
                <Badge variant="outline" className={progress.badgeClass}>
                  {progress.badgeLabel}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{progress.guidanceText}</p>
            </div>
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {isRefreshing ? "Refreshing…" : "Refresh Status"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
          {/* 4-Step Visual Mini-Tracker */}
          <div
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={`${kind} Defense stage progress`}
          >
            {progress.steps.map((mini) => {
              const isDone = mini.state === "completed";
              const isActive = mini.state === "active";
              return (
                <div
                  key={mini.stepNumber}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                    isDone
                      ? "border-emerald-200 bg-emerald-50/50"
                      : isActive
                        ? "border-[#e02b20] bg-[#fff5f5]/70 ring-1 ring-[#e02b20]/15"
                        : "border-gray-200 bg-gray-50/50 opacity-75"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isActive ? (
                      <Clock className="h-4 w-4 text-[#e02b20]" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-400">
                        {mini.stepNumber}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold ${
                        isDone
                          ? "text-emerald-900"
                          : isActive
                            ? "text-[#91060c]"
                            : "text-gray-600"
                      }`}
                    >
                      {mini.stepNumber}. {mini.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {mini.sublabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Action / Handled By Callout */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-gray-600">
              <span className="font-semibold text-[#333333]">
                Current Step Handled By:
              </span>
              <Badge variant="outline" className="bg-white text-[#333333]">
                {progress.handledBy}
              </Badge>
              {step?.nextAction && (
                <span className="text-gray-600">
                  · {step.nextAction.replace(/Admin review/gi, "Graduate School review")}
                </span>
              )}
            </div>
            {extra ? <div>{extra}</div> : null}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Defense Schedule & Official Application Record (when scheduled) */}
      <DefenseScheduleSummary session={step?.defenseSession} />

      {/* Card 3: Submitted Stage Documents & Adviser Certification */}
      <Card>
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
            <FileText className="h-4 w-4 text-[#e02b20]" />
            Submitted {kind} Defense Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm">
          {docsLoading && (
            <p className="text-gray-500">Loading submitted documents…</p>
          )}
          {docsError && (
            <div className="space-y-2">
              <p className="text-gray-500">
                Unable to load the submitted documents.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchDocs()}
              >
                Try again
              </Button>
            </div>
          )}
          {!docsLoading &&
            !docsError &&
            requiredDocs.map((slot) => (
              <DocRow
                key={slot.docType}
                label={slot.label}
                doc={currentByType.get(slot.docType) ?? null}
                onView={setViewerDoc}
              />
            ))}

          {(kind === "Proposal" || kind === "Final") &&
            application?.thesisId && (
              <div className="pt-2">
                <AdviserCertificationRecords
                  thesisId={application.thesisId}
                  stage={kind === "Proposal" ? "PROPOSAL" : "FINAL"}
                />
              </div>
            )}
        </CardContent>
      </Card>

      {status === "APPLICATION_UNDER_REVIEW" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-2xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e02b20]" />
          <div>
            <p className="font-semibold text-[#333333]">
              Need to correct a submitted document?
            </p>
            <p className="mt-0.5">
              Documents under active Graduate School review cannot be replaced
              directly while verification is in progress. If a correction is
              needed, the Graduate School can return the application so you can
              upload a replacement.
            </p>
          </div>
        </div>
      )}

      {viewerDoc && (
        <DocumentViewer
          open={viewerDoc !== null}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          fetchUrl={`/api/documents/thesis-document/${viewerDoc.id}/file`}
          title={viewerDoc.originalFilename || "Submitted document"}
        />
      )}
    </div>
  );
}
