"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ExternalLink, Printer, RefreshCw } from "lucide-react";
import {
  formatDefenseDate,
  formatDefenseTime,
  parseVenueOrLink,
  ROLE_LABELS,
  sessionStatusLabel,
} from "@/components/admin/defense-applications/labels";
import {
  defenseTypeLabel,
  stageFromDefenseType,
} from "@/components/admin/defense-scheduling/types";

interface EvaluationRow {
  panelAssignmentId: string;
  evaluatorName: string;
  role: string;
  status: string;
  overallValue: number | null;
  hasOfficialCriteria: boolean;
  signedAt: string | null;
  finalizedAt: string | null;
}

interface SignatoryRow {
  name: string | null;
  roleAtDefense: string | null;
  required: boolean;
  isSigned: boolean;
  signedAt: string | null;
}

interface RecordDetail {
  scheduleId: string;
  defenseOverview: {
    studentName: string | null;
    studentNumber: string | null;
    program: string | null;
    defenseType: string;
    defenseDate: string | null;
    defenseTime: string | null;
    venueOrLink: string | null;
    sessionStatus: string;
    formalResult: string | null;
    concludedAt: string | null;
    committee: Array<{ userId: string; name: string; role: string }>;
    proposedTitles: Array<{ id: string; titleText: string; isSelected: boolean }>;
  };
  individualEvaluations: EvaluationRow[];
  oralExamSummary: {
    ready: boolean;
    overallAverage: number | null;
    finalRating: string | null;
    evaluatorCount?: number;
    rows: Array<{
      evaluatorName: string;
      functionalRole: string;
      groupIValue: number | null;
      groupIIValue: number | null;
      overallValue: number | null;
      rating: string | null;
    }>;
    generatedAt: string | null;
  };
  rapReport: {
    id: string;
    status: string;
    generatedAt: string | null;
    finalizedAt: string | null;
    selectedTitle: string | null;
    requiredSignatures: number;
    signedSignatures: number;
    signatories: SignatoryRow[];
  } | null;
}

/* --------------------------------------------------------------- labels */

const RESULT_LABELS: Record<string, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  REVISION_REQUIRED: "Revision Required",
};
const RESULT_BADGE_CLASS: Record<string, string> = {
  PASSED: "text-(--earist-success)",
  FAILED: "text-destructive",
  REVISION_REQUIRED: "text-(--earist-warning)",
};

const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  RESCHEDULED: "text-(--earist-secondary)",
  IN_PROGRESS: "text-(--earist-warning)",
  AWAITING_CONCLUSION: "text-(--earist-warning)",
  CONCLUDED: "text-(--earist-success)",
  CANCELLED: "text-destructive",
};

const EVALUATOR_STATUS_LABELS: Record<string, string> = {
  FINALIZED: "Finalized",
  DRAFT: "Draft",
  NOT_STARTED: "Not Started",
};
const EVALUATOR_STATUS_CLASS: Record<string, string> = {
  FINALIZED: "text-(--earist-success)",
  DRAFT: "text-(--earist-warning)",
  NOT_STARTED: "text-(--earist-body-text)",
};

const RAP_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  FOR_SIGNATURE: "Awaiting Signatures",
  PARTIALLY_SIGNED: "Partially Signed",
  DISTRIBUTED: "Distributed",
  ALL_SIGNED: "All Signed",
  FINALIZED: "Finalized",
};
const RAP_STATUS_CLASS: Record<string, string> = {
  DRAFT: "text-(--earist-body-text)",
  FOR_SIGNATURE: "text-(--earist-warning)",
  PARTIALLY_SIGNED: "text-(--earist-warning)",
  DISTRIBUTED: "text-(--earist-warning)",
  ALL_SIGNED: "text-(--earist-warning)",
  FINALIZED: "text-(--earist-success)",
};

const COMMITTEE_ROLE_ORDER = [
  "ADVISER",
  "CHAIRMAN",
  "PANELIST",
  "FACILITATOR",
  "RAPPORTEUR",
] as const;

function committeeRoleLabel(role: string): string {
  if (role === "PANELIST") return "Panelists";
  return ROLE_LABELS[role] ?? role;
}

function resultLabel(result: string): string {
  return RESULT_LABELS[result] ?? result.replace(/_/g, " ");
}

function evaluatorStatusLabel(status: string): string {
  return EVALUATOR_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function rapStatusLabel(status: string | null | undefined): string {
  if (!status) return "Not generated";
  return RAP_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

/**
 * A signing timestamp is a real instant (not a wall-clock schedule field), so it
 * is formatted as an ordinary local date rather than through the Defense
 * wall-clock helpers (which read UTC components).
 */
function formatSignedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------ fragments */

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-(--earist-body-text)">{label}</p>
      <div className="text-sm break-words text-foreground">{children}</div>
    </div>
  );
}

function CommitteeRoster({
  committee,
}: {
  committee: RecordDetail["defenseOverview"]["committee"];
}) {
  const groups = COMMITTEE_ROLE_ORDER.map((role) => ({
    role,
    label: committeeRoleLabel(role),
    names: committee.filter((c) => c.role === role).map((c) => c.name),
  })).filter((g) => g.names.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-(--earist-body-text)">
        No committee participants recorded.
      </p>
    );
  }

  return (
    <div className="divide-y divide-(--earist-border-gray)">
      {groups.map((group) => (
        <div
          key={group.role}
          className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:items-start sm:gap-3"
        >
          <span className="text-sm font-semibold text-(--earist-secondary)">
            {group.label}
          </span>
          <span className="min-w-0 text-sm break-words text-foreground">
            {group.names.join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- skeleton */

/**
 * Section-owned document action placeholder. The future official document
 * outputs are not implemented yet, so this is a real, semantically disabled
 * button: no href, no no-op click handler, no window.print(), no fake PDF.
 */
function DownloadPrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      title="Document output is not available yet"
    >
      <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
      Download / Print
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-4 w-56" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export default function AdminDefenseRecordDetailPage() {
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<RecordDetail>({
      queryKey: ["adminDefenseRecord", scheduleId],
      queryFn: async () =>
        (await apiClientRequest(
          `/thesis/defense/${scheduleId}/records`,
        )) as RecordDetail,
      retry: false,
    });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  const notFound =
    error instanceof ApiError && error.statusCode === 404;

  if (notFound) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: "Defense Records", href: "/admin/thesis/defense-records" }]}
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center">
          <AlertCircle className="h-8 w-8 text-(--earist-secondary)" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-(--earist-primary)">
              Defense record not found
            </p>
            <p className="text-sm text-(--earist-body-text)">
              This defense session may no longer exist, or the link is incorrect.
            </p>
          </div>
          <Link
            href="/admin/thesis/defense-records"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Defense Records
          </Link>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[{ label: "Defense Records", href: "/admin/thesis/defense-records" }]}
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center">
          <AlertCircle className="h-8 w-8 text-(--earist-secondary)" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-(--earist-primary)">
              Unable to load defense record
            </p>
            <p className="text-sm text-(--earist-body-text)">
              The record could not be loaded. Please try again.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const o = data.defenseOverview;
  const stage = stageFromDefenseType(o.defenseType);
  const isTitleDefense = stage === "TITLE";
  const selectedTitle =
    data.rapReport?.selectedTitle ??
    o.proposedTitles.find((t) => t.isSelected)?.titleText ??
    null;
  const venue = parseVenueOrLink(o.venueOrLink);

  // RAP required-signature progress is derived from the signatory rows so it
  // can never over-count optional signers (exact §9 formula).
  const requiredSigners = data.rapReport
    ? data.rapReport.signatories.filter((s) => s.required !== false)
    : [];
  const signedRequiredSigners = requiredSigners.filter((s) => s.isSigned).length;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Defense Records", href: "/admin/thesis/defense-records" },
          { label: o.studentName ?? "Defense Record" },
        ]}
      />

      <PageHeader
        title="Defense Record"
        description="Review the defense session, academic results, committee record, and related defense documents."
      />

      {/* Defense Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Defense Overview
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  SESSION_BADGE_CLASS[o.sessionStatus.toUpperCase()],
                )}
              >
                {sessionStatusLabel(o.sessionStatus)}
              </Badge>
              <DownloadPrintButton />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaItem label="Student">
              {o.studentName ?? "—"}
            </MetaItem>
            <MetaItem label="Student No.">
              {o.studentNumber ?? "—"}
            </MetaItem>
            <MetaItem label="Program">{o.program ?? "—"}</MetaItem>
            <MetaItem label="Defense Stage">{defenseTypeLabel(stage)}</MetaItem>
            <MetaItem label="Defense Date">
              {formatDefenseDate(o.defenseDate)}
              {o.defenseTime ? (
                <span className="block text-xs tabular-nums text-(--earist-body-text)">
                  {formatDefenseTime(o.defenseTime)}
                </span>
              ) : null}
            </MetaItem>
            <MetaItem label="Venue / Meeting Details">
              {venue.kind === "url" ? (
                <a
                  href={venue.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-(--earist-primary) underline underline-offset-2 hover:text-(--earist-secondary)"
                >
                  Open Meeting Link
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : venue.kind === "text" ? (
                venue.text
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem label="Formal Result">
              {o.formalResult ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    RESULT_BADGE_CLASS[o.formalResult],
                  )}
                >
                  {resultLabel(o.formalResult)}
                </Badge>
              ) : (
                <span className="text-(--earist-body-text)">—</span>
              )}
            </MetaItem>
            {selectedTitle ? (
              <MetaItem label="Official Title">{selectedTitle}</MetaItem>
            ) : null}
          </div>

          <div className="border-t border-(--earist-border-gray) pt-3">
            <h3 className="mb-1 text-sm font-semibold text-(--earist-secondary)">
              Defense Committee
            </h3>
            <CommitteeRoster committee={o.committee} />
          </div>
        </CardContent>
      </Card>

      {/* Numerical evaluation — Title N/A (compact) vs Proposal/Final sections */}
      {isTitleDefense ? (
        <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) px-4 py-3">
          <p className="text-sm text-(--earist-body-text)">
            Numerical Oral Examination Criteria and Summary are not applicable
            to Title Defense. The formal Chairman-recorded result and the
            RAP / Committee Report remain the official outputs for this session.
          </p>
        </div>
      ) : (
        <>
          {/* Evaluation Results */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Evaluation Results
                </CardTitle>
                <DownloadPrintButton />
              </div>
            </CardHeader>
            <CardContent>
              {data.individualEvaluations.length === 0 ? (
                <p className="text-sm text-(--earist-body-text)">
                  No authorized evaluator records found for this session.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-(--earist-border-gray) text-xs font-semibold text-(--earist-body-text)">
                        <th className="px-3 py-2">Evaluator</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Overall</th>
                        <th className="px-3 py-2">Criteria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.individualEvaluations.map((e) => (
                        <tr
                          key={e.panelAssignmentId}
                          className="border-b border-(--earist-border-gray) last:border-0"
                        >
                          <td className="px-3 py-2 break-words">
                            {e.evaluatorName}
                          </td>
                          <td className="px-3 py-2">
                            {ROLE_LABELS[e.role] ?? e.role}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium",
                                EVALUATOR_STATUS_CLASS[e.status],
                              )}
                            >
                              {evaluatorStatusLabel(e.status)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {e.overallValue ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {e.hasOfficialCriteria ? "Available" : "Not available"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Oral Examination Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Oral Examination Summary
                </CardTitle>
                <DownloadPrintButton />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!data.oralExamSummary.ready ? (
                <p className="text-(--earist-body-text)">
                  Awaiting evaluator finalization.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <MetaItem label="Overall Average">
                      <span className="tabular-nums">
                        {data.oralExamSummary.overallAverage ?? "—"}
                      </span>
                    </MetaItem>
                    <MetaItem label="Final Rating">
                      {data.oralExamSummary.finalRating ?? "Not assigned"}
                    </MetaItem>
                  </div>
                  {data.oralExamSummary.rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-(--earist-border-gray) font-semibold text-(--earist-body-text)">
                            <th className="px-3 py-2">Examiner</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Group I</th>
                            <th className="px-3 py-2">Group II</th>
                            <th className="px-3 py-2">Overall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.oralExamSummary.rows.map((r, i) => (
                            <tr
                              key={i}
                              className="border-b border-(--earist-border-gray) last:border-0"
                            >
                              <td className="px-3 py-2 break-words">
                                {r.evaluatorName}
                              </td>
                              <td className="px-3 py-2">
                                {ROLE_LABELS[r.functionalRole] ??
                                  r.functionalRole}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {r.groupIValue ?? "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {r.groupIIValue ?? "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {r.overallValue ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-(--earist-body-text)">
                      No per-evaluator summary rows recorded.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* RAP / Committee Report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              RAP / Committee Report
            </CardTitle>
            <DownloadPrintButton />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!data.rapReport ? (
            <p className="text-(--earist-body-text)">
              Not generated yet — the RAP is created after the formal conclusion.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    RAP_STATUS_CLASS[data.rapReport.status],
                  )}
                >
                  {rapStatusLabel(data.rapReport.status)}
                </Badge>
                <span className="text-(--earist-body-text)">
                  {signedRequiredSigners} of {requiredSigners.length} required
                  signatures completed
                </span>
              </div>

              {data.rapReport.signatories.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-(--earist-border-gray) font-semibold text-(--earist-body-text)">
                        <th className="px-3 py-2">Signer</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Signature Status</th>
                        <th className="px-3 py-2">Signed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rapReport.signatories.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-(--earist-border-gray) last:border-0"
                        >
                          <td className="px-3 py-2 break-words">
                            {s.name ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {s.roleAtDefense
                              ? (ROLE_LABELS[s.roleAtDefense] ?? s.roleAtDefense)
                              : "—"}
                            {!s.required && (
                              <span className="ml-1 text-(--earist-body-text)">
                                · Optional
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium",
                                s.isSigned
                                  ? "text-(--earist-success)"
                                  : "text-(--earist-warning)",
                              )}
                            >
                              {s.isSigned ? "Signed" : "Awaiting Signature"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatSignedAt(s.signedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-(--earist-body-text)">
                  No signatory records found.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
