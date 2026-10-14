"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { resolveDefenseVenue } from "@/lib/student-dashboard";
import {
  formatDefenseDate,
  formatDefenseTime,
} from "@/lib/student-thesis-journey";
import type {
  DefenseSessionSummary,
} from "@/types/student-thesis-journey";
import {
  CalendarDays,
  Clock,
  FileText,
  Eye,
  Info,
  ExternalLink,
} from "lucide-react";

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

/** UIUX-4B FIX-1 / UIUX-4C: Title requires these three authoritative documents. */
const REQUIRED_DOCUMENTS: { docType: string; label: string }[] = [
  { docType: "TITLE_PROPOSAL", label: "Title Defense Proposal Package" },
  { docType: "COR", label: "Current Semester COR" },
  { docType: "RECEIPT", label: "Defense-fee Proof of Payment" },
];

/** The three post-submission states owned by UIUX-4C. */
export type TitlePostSubmissionStatus =
  | "APPLICATION_UNDER_REVIEW"
  | "APPROVED_WAITING_SCHEDULE"
  | "SCHEDULED";

interface StatusCopy {
  heading: string;
  description: string;
  extra?: string;
  rows: { label: string; value: string }[];
}

const STATUS_COPY: Record<TitlePostSubmissionStatus, StatusCopy> = {
  APPLICATION_UNDER_REVIEW: {
    heading: "Under Graduate School Review",
    description:
      "Your Title Defense application was submitted successfully and is currently under Graduate School review.",
    rows: [
      { label: "Application Status", value: "Under Review" },
      { label: "Defense Schedule", value: "Not available yet" },
      { label: "Your Action", value: "None for now" },
      { label: "Next Action By", value: "Graduate School" },
    ],
  },
  APPROVED_WAITING_SCHEDULE: {
    heading: "Application Approved",
    description:
      "Your Title Defense application requirements have been approved by the Graduate School. Your defense has not been scheduled yet.",
    extra:
      "The Graduate School will prepare your defense schedule and committee assignment. You will see the schedule here once it is available.",
    rows: [
      { label: "Application Status", value: "Approved" },
      { label: "Defense Schedule", value: "Waiting for schedule" },
      { label: "Your Action", value: "None for now" },
      { label: "Next Action By", value: "Graduate School" },
    ],
  },
  SCHEDULED: {
    heading: "Defense Scheduled",
    description:
      "Your Title Defense has been scheduled. Review the schedule details below and prepare to attend your defense.",
    rows: [
      { label: "Application Status", value: "Approved" },
      { label: "Defense Schedule", value: "Scheduled" },
      {
        label: "Your Action",
        value: "Prepare for and attend your Title Defense",
      },
    ],
  },
};

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Whole-HTTP(S)-URL => clickable meeting link; otherwise plain text. Never infers mode. */
function VenueValue({ venueOrLink }: { venueOrLink: string | null | undefined }) {
  const venue = resolveDefenseVenue(venueOrLink);
  if (venue.kind === "none") {
    return <span className="text-(--earist-body-text)">To be announced</span>;
  }
  if (venue.kind === "physical") {
    return <span className="break-words font-medium">{venue.text}</span>;
  }
  return (
    <a
      href={venue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 break-all font-medium text-(--earist-secondary) hover:underline focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
    <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-(--earist-surface-gray)">
          <FileText className="h-4 w-4 text-(--earist-primary)" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-(--earist-primary)">{label}</p>
          <p className="truncate text-xs text-(--earist-body-text)">
            {doc ? doc.originalFilename || label : "Not yet available"}
          </p>
          {doc && (
            <p className="text-xs text-(--earist-body-text)">
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
          <Badge variant="outline" className="text-(--earist-success)">
            On file
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onView(doc)}
            aria-label={`View ${label}`}
          >
            <Eye className="mr-1 h-4 w-4" /> View
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * UIUX-4C — Student Title Defense post-submission status presentation for the
 * three closely related states: Under Graduate School Review, Application
 * Approved / Waiting for Schedule, and Defense Scheduled.
 *
 * Journey status (application + schedule) is the authoritative layer and always
 * renders; the Submitted Documents section is isolated so a document-query
 * failure never erases the status. The pre-defense schedule presentation does
 * NOT surface RAP. Later academic/result states are handled elsewhere.
 */
export function TitleDefensePostSubmission({
  defenseStatus,
  session,
}: {
  defenseStatus: TitlePostSubmissionStatus;
  session: DefenseSessionSummary | null | undefined;
}) {
  const [viewerDoc, setViewerDoc] = useState<CurrentEvidenceDto | null>(null);
  const copy = STATUS_COPY[defenseStatus];

  const { data: application, isLoading, isError, refetch } = useQuery<
    CurrentApplicationDto | null
  >({
    queryKey: ["student", "thesis", "current-application"],
    queryFn: async () => apiClientRequest("/thesis/defense/current"),
  });

  const currentByType = new Map(
    (application?.evidence ?? [])
      .filter((e) => e.isCurrent)
      .map((e) => [e.docType, e]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Title Defense" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
            {defenseStatus === "SCHEDULED" ? (
              <CalendarDays className="h-4 w-4 text-(--earist-secondary)" />
            ) : (
              <Clock className="h-4 w-4 text-amber-600" />
            )}
            {copy.heading}
          </CardTitle>
          <p className="text-sm text-(--earist-body-text)">{copy.description}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="divide-y divide-(--earist-border-gray)">
            {copy.rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <dt className="text-xs font-medium tracking-wide text-(--earist-body-text) uppercase">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium break-words text-(--earist-secondary) sm:text-right">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          {copy.extra && (
            <p className="text-sm text-(--earist-body-text)">{copy.extra}</p>
          )}
        </CardContent>
      </Card>

      {defenseStatus === "SCHEDULED" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Defense Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-(--earist-body-text) uppercase">
                  Date
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-(--earist-secondary)">
                  <CalendarDays className="h-4 w-4 shrink-0 text-(--earist-primary)" />
                  {formatDefenseDate(session?.defenseDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-(--earist-body-text) uppercase">
                  Time
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-(--earist-secondary)">
                  <Clock className="h-4 w-4 shrink-0 text-(--earist-primary)" />
                  {formatDefenseTime(session?.defenseTime)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium tracking-wide text-(--earist-body-text) uppercase">
                  Venue / Meeting Details
                </p>
                <div className="mt-0.5 text-sm text-(--earist-secondary)">
                  <VenueValue venueOrLink={session?.venueOrLink} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Submitted Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading && (
            <p className="text-(--earist-body-text)">
              Loading submitted documents…
            </p>
          )}
          {isError && (
            <div className="space-y-2">
              <p className="text-(--earist-body-text)">
                Unable to load the submitted documents.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {!isLoading &&
            !isError &&
            REQUIRED_DOCUMENTS.map((slot) => (
              <DocRow
                key={slot.docType}
                label={slot.label}
                doc={currentByType.get(slot.docType) ?? null}
                onView={setViewerDoc}
              />
            ))}
        </CardContent>
      </Card>

      {defenseStatus === "APPLICATION_UNDER_REVIEW" && (
        <div className="flex items-start gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-secondary)" />
          <div>
            <p className="font-medium text-(--earist-secondary)">
              Need to correct a submitted document?
            </p>
            <p>
              Documents under active Graduate School review cannot be silently
              replaced directly by the Student. If a correction is required, the
              Graduate School can return the application so you can upload a
              replacement.
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
