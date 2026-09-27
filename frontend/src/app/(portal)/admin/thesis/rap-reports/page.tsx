"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  Send,
  PenTool,
  Users,
  Filter,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

/** CP7 canonical UI status keys. */
type RapUiStatus = "awaiting" | "partial" | "finalized" | "legacy";

interface RapReportData {
  id: string;
  scheduleId: string;
  studentName: string;
  studentNumber: string;
  program: string;
  stage: string;
  defenseDate: string;
  /** Backend RapReport.status — lifecycle authority. */
  rawStatus: string;
  status: RapUiStatus;
  generatedAt: string | null;
  panelists: {
    name: string;
    role: string;
    signed: boolean;
    signedAt: string | null;
  }[];
}

interface BackendRapReport {
  id: string;
  scheduleId: string;
  status: string;
  generatedAt: string | null;
  thesis: {
    student: {
      user: { firstName: string; lastName: string };
      studentNumber: string | null;
      program?: { programName?: string | null };
    };
  };
  schedule: {
    defenseType: string;
    defenseDate: string;
    panelAssignments: { userId: string; role: string }[];
  };
  signatures: {
    userId: string;
    roleAtDefense?: string | null;
    isSigned: boolean;
    signedAt: string | null;
    user: { firstName: string; lastName: string };
  }[];
}

/**
 * CP7-FIX3: backend status is the lifecycle authority.
 * Signature counts are progress metadata only.
 */
function mapBackendStatus(raw: string): RapUiStatus {
  switch (raw) {
    case "FOR_SIGNATURE":
      return "awaiting";
    case "PARTIALLY_SIGNED":
      return "partial";
    case "FINALIZED":
      return "finalized";
    default:
      // DRAFT / DISTRIBUTED / ALL_SIGNED / others — legacy, not active CP7 steps.
      return "legacy";
  }
}

function mapRapReport(rap: BackendRapReport): RapReportData {
  const programName = rap.thesis.student.program?.programName ?? null;
  return {
    id: rap.id,
    scheduleId: rap.scheduleId,
    studentName: `${rap.thesis.student.user.firstName} ${rap.thesis.student.user.lastName}`,
    studentNumber: rap.thesis.student.studentNumber || "N/A",
    program: programName || "Program",
    stage: rap.schedule.defenseType.toLowerCase(),
    defenseDate: rap.schedule.defenseDate
      ? new Date(rap.schedule.defenseDate).toLocaleDateString()
      : "—",
    rawStatus: rap.status,
    status: mapBackendStatus(rap.status),
    generatedAt: rap.generatedAt
      ? new Date(rap.generatedAt).toLocaleDateString()
      : null,
    panelists: rap.signatures.map((sig) => {
      const assignment = rap.schedule.panelAssignments.find(
        (p) => p.userId === sig.userId,
      );
      return {
        name: `${sig.user.firstName} ${sig.user.lastName}`,
        role: assignment?.role || sig.roleAtDefense || "Panelist",
        signed: sig.isSigned === true,
        signedAt: sig.signedAt
          ? new Date(sig.signedAt).toLocaleString()
          : null,
      };
    }),
  };
}

async function fetchReportsData(): Promise<RapReportData[]> {
  const data = await apiClientRequest("/thesis/defense/rap-reports/all");
  const list: BackendRapReport[] = Array.isArray(data) ? data : [];
  return list.map(mapRapReport);
}

export default function AdminRAPReportsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const { data: rapReports = [], isLoading, isError, error } = useQuery({
    queryKey: ["adminRapReports"],
    queryFn: fetchReportsData,
  });

  // CP7-FIX3: reminder is notification-only — allowed only while signatures pending.
  const remindMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClientRequest(`/thesis/defense/rap-reports/${id}/remind`, {
        method: "POST",
      }),
    onSuccess: () => {
      alert("Reminders queued successfully!");
    },
  });

  const handleRemind = useCallback(
    (id: string) => {
      remindMutation.mutate(id);
    },
    [remindMutation],
  );

  const filteredReports = rapReports.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  const selectedReportData = rapReports.find((r) => r.id === selectedReport);

  const awaitingCount = rapReports.filter((r) => r.status === "awaiting").length;
  const partialCount = rapReports.filter((r) => r.status === "partial").length;
  const finalizedCount = rapReports.filter((r) => r.status === "finalized").length;
  const legacyCount = rapReports.filter((r) => r.status === "legacy").length;

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case "title_defense":
        return "Title Defense";
      case "proposal_defense":
        return "Proposal Defense";
      case "final_defense":
        return "Final Defense";
      default:
        return stage;
    }
  };

  const getStatusBadge = (status: RapUiStatus) => {
    switch (status) {
      case "awaiting":
        return (
          <Badge className="bg-gray-100 text-gray-700">
            <Clock className="mr-1 h-3 w-3" />
            Awaiting Signatures
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <PenTool className="mr-1 h-3 w-3" />
            Partially Signed
          </Badge>
        );
      case "finalized":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Finalized
          </Badge>
        );
      case "legacy":
        return (
          <Badge variant="outline" className="text-(--earist-body-text)">
            Legacy Status
          </Badge>
        );
      default:
        return null;
    }
  };

  const getSignedCount = (panelists: { signed: boolean }[]) =>
    panelists.filter((p) => p.signed).length;

  const canRemind =
    selectedReportData &&
    (selectedReportData.rawStatus === "FOR_SIGNATURE" ||
      selectedReportData.rawStatus === "PARTIALLY_SIGNED");

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          RAP Report Status
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Read-only RAP signature status. Lifecycle is signature-driven only:
          Awaiting Signatures → Partially Signed → Finalized. Official outputs
          live in Defense Records.
        </p>
        <Link
          href="/admin/thesis/defense-records"
          className="mt-2 inline-block text-sm text-(--earist-primary) underline"
        >
          Open Defense Records →
        </Link>
      </div>

      {/* CP7 canonical summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Awaiting Signatures
            </p>
            <p className="text-lg font-bold text-gray-600">{awaitingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Partially Signed
            </p>
            <p className="text-lg font-bold text-amber-600">{partialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Finalized</p>
            <p className="text-lg font-bold text-green-600">{finalizedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Legacy / Other
            </p>
            <p className="text-lg font-bold text-(--earist-body-text)">
              {legacyCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter — no Distributed as a canonical category */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-(--earist-body-text)" />
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "awaiting", label: "Awaiting Signatures" },
                { value: "partial", label: "Partially Signed" },
                { value: "finalized", label: "Finalized" },
                ...(legacyCount > 0
                  ? [{ value: "legacy", label: "Legacy" }]
                  : []),
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === f.value ? "bg-(--earist-primary) text-white" : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {isLoading && (
            <p className="py-8 text-center text-sm text-(--earist-body-text)">
              Loading RAP reports...
            </p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-red-600">
              Unable to load RAP reports
              {error instanceof Error && error.message
                ? `: ${error.message}`
                : "."}
            </p>
          )}
          {!isLoading && !isError && filteredReports.length === 0 && (
            <p className="py-8 text-center text-sm text-(--earist-body-text)">
              No RAP reports match the selected filter.
            </p>
          )}
          {!isLoading &&
            !isError &&
            filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedReport === report.id ? "border-(--earist-primary) bg-(--earist-surface-light-red)" : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-(--earist-primary)">
                      {report.studentName}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {getStageLabel(report.stage)} &middot; {report.program}
                    </p>
                  </div>
                  {getStatusBadge(report.status)}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-(--earist-body-text)">
                  <Users className="h-3 w-3" />
                  <span>
                    {getSignedCount(report.panelists)}/{report.panelists.length}{" "}
                    signed
                  </span>
                </div>
              </button>
            ))}
        </div>

        {selectedReportData ? (
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    RAP Report — {getStageLabel(selectedReportData.stage)}
                  </CardTitle>
                  {getStatusBadge(selectedReportData.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-(--earist-body-text)">Student</p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedReportData.studentName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--earist-body-text)">
                      Student Number
                    </p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedReportData.studentNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--earist-body-text)">Program</p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedReportData.program}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--earist-body-text)">
                      Defense Date
                    </p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedReportData.defenseDate}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-(--earist-body-text)">
                      Backend status
                    </p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedReportData.rawStatus}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  E-Signature Status (
                  {getSignedCount(selectedReportData.panelists)}/
                  {selectedReportData.panelists.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedReportData.panelists.map((panelist, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded ${panelist.signed ? "bg-green-50" : "bg-gray-50"}`}
                      >
                        {panelist.signed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {panelist.name}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {panelist.role}
                        </p>
                      </div>
                      {panelist.signed ? (
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Signed
                          </Badge>
                          <p className="mt-1 text-[11px] text-(--earist-body-text)">
                            {panelist.signedAt}
                          </p>
                        </div>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          <Clock className="mr-1 h-3 w-3" />
                          Awaiting
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-(--earist-body-text)">
                    Signature Progress (metadata only — status is lifecycle
                    authority)
                  </span>
                  <span className="text-xs font-medium text-(--earist-primary)">
                    {getSignedCount(selectedReportData.panelists)}/
                    {selectedReportData.panelists.length}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-(--earist-border-gray)">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${(getSignedCount(selectedReportData.panelists) /
                        Math.max(selectedReportData.panelists.length, 1)) *
                        100}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Read-only actions — no Admin lifecycle mutation */}
            <div className="flex flex-wrap gap-2">
              {selectedReportData.status === "legacy" && (
                <p className="flex-1 rounded border border-(--earist-border-gray) p-2 text-xs text-(--earist-body-text)">
                  Legacy status — not an active CP7 lifecycle step. Use Defense
                  Records for official outputs.
                </p>
              )}
              {canRemind && (
                <Button
                  onClick={() => handleRemind(selectedReportData.id)}
                  variant="outline"
                  className="flex-1"
                  disabled={remindMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Reminder
                </Button>
              )}
              {selectedReportData.status === "finalized" && (
                <div className="w-full space-y-2">
                  <Link
                    href={`/admin/thesis/defense-records/${selectedReportData.scheduleId}`}
                    className={buttonVariants({
                      className:
                        "w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90",
                    })}
                  >
                    View Official Defense Record
                  </Link>
                  <p className="text-xs text-(--earist-body-text)">
                    Official Criteria, Oral Summary, and RAP are available in
                    Defense Records.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <FileText className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a RAP Report
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click a report to view signature status. Official outputs
                    are in Defense Records.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
