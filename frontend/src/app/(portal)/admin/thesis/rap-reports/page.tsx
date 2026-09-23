"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  Download,
  Send,
  PenTool,
  Users,
  Filter,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface RapReportData {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  stage: string;
  defenseDate: string;
  status: string;
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
  status: string;
  generatedAt: string | null;
  thesis: {
    student: {
      user: { firstName: string; lastName: string };
      studentNumber: string | null;
      program?: { code?: string; name?: string };
    }
  };
  schedule: {
    defenseType: string;
    defenseDate: string;
    panelAssignments: { userId: string; role: string }[];
  };
  signatures: {
    userId: string;
    isSigned: boolean;
    signedAt: string | null;
    user: { firstName: string; lastName: string };
  }[];
}

function mapRapReport(rap: BackendRapReport): RapReportData {
  let uiStatus = "pending";
  if (rap.status === "DRAFT") uiStatus = "pending";
  else if (rap.status === "DISTRIBUTED") {
    const signedCount = rap.signatures.filter((s) => s.isSigned).length;
    if (signedCount === 0) uiStatus = "distributed";
    else if (signedCount < rap.signatures.length) uiStatus = "partial";
    else uiStatus = "finalized";
  } else if (rap.status === "ALL_SIGNED" || rap.status === "FINALIZED") {
    uiStatus = "finalized";
  }

  return {
    id: rap.id,
    studentName: `${rap.thesis.student.user.firstName} ${rap.thesis.student.user.lastName}`,
    studentNumber: rap.thesis.student.studentNumber || "N/A",
    program:
      rap.thesis.student.program?.code ||
      rap.thesis.student.program?.name ||
      "Program",
    stage: rap.schedule.defenseType.toLowerCase(),
    defenseDate: rap.schedule.defenseDate
      ? new Date(rap.schedule.defenseDate).toLocaleDateString()
      : "—",
    status: uiStatus,
    generatedAt: rap.generatedAt
      ? new Date(rap.generatedAt).toLocaleDateString()
      : null,
    panelists: rap.signatures.map((sig) => {
      const assignment = rap.schedule.panelAssignments.find(
        (p) => p.userId === sig.userId,
      );
      return {
        name: `${sig.user.firstName} ${sig.user.lastName}`,
        role: assignment?.role || "Panelist",
        signed: sig.isSigned,
        signedAt: sig.signedAt
          ? new Date(sig.signedAt).toLocaleString()
          : null,
      };
    }),
  };
}

async function fetchReportsData(): Promise<RapReportData[]> {
  // Correct mount is /api/thesis/defense/... (see thesis.routes + /api router).
  // Auth comes from the NextAuth session via apiClientRequest — not localStorage.
  const data = await apiClientRequest("/thesis/defense/rap-reports/all");
  const list: BackendRapReport[] = Array.isArray(data) ? data : [];
  return list.map(mapRapReport);
}

export default function AdminRAPReportsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const {
    data: rapReports = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["adminRapReports"],
    queryFn: fetchReportsData,
  });

  const distributeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClientRequest(`/thesis/defense/rap-reports/${id}/distribute`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminRapReports"] });
    },
  });

  const remindMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClientRequest(`/thesis/defense/rap-reports/${id}/remind`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      alert("Reminders queued successfully!");
    },
  });

  const handleDistribute = useCallback(
    (id: string) => {
      distributeMutation.mutate(id);
    },
    [distributeMutation],
  );

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

  const pendingCount = rapReports.filter((r) => r.status === "pending").length;
  const distributedCount = rapReports.filter(
    (r) => r.status === "distributed",
  ).length;
  const partialCount = rapReports.filter((r) => r.status === "partial").length;
  const finalizedCount = rapReports.filter(
    (r) => r.status === "finalized",
  ).length;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-gray-100 text-gray-500">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "distributed":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Send className="mr-1 h-3 w-3" />
            Distributed
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <PenTool className="mr-1 h-3 w-3" />
            Partial
          </Badge>
        );
      case "finalized":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Finalized
          </Badge>
        );
      default:
        return null;
    }
  };

  const getSignedCount = (panelists: { signed: boolean }[]) =>
    panelists.filter((p) => p.signed).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          RAP Report Management
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Generate, distribute, and track RAP Report e-signatures
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Pending</p>
            <p className="text-lg font-bold text-gray-500">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Distributed
            </p>
            <p className="text-lg font-bold text-blue-600">
              {distributedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Partial</p>
            <p className="text-lg font-bold text-amber-600">{partialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Finalized</p>
            <p className="text-lg font-bold text-green-600">{finalizedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-(--earist-body-text)" />
            <div className="flex gap-2">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "distributed", label: "Distributed" },
                { value: "partial", label: "Partial" },
                { value: "finalized", label: "Finalized" },
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
        {/* Reports List */}
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
              <div className="flex items-center justify-between">
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

        {/* Report Detail */}
        {selectedReportData ? (
          <div className="space-y-4 lg:col-span-2">
            {/* Report Info */}
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
                    <p className="text-xs text-(--earist-body-text)">
                      Student
                    </p>
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
                    <p className="text-xs text-(--earist-body-text)">
                      Program
                    </p>
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
                </div>
              </CardContent>
            </Card>

            {/* E-Signature Tracking */}
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

            {/* Progress Bar */}
            <Card>
              <CardContent className="py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-(--earist-body-text)">
                    Signature Progress
                  </span>
                  <span className="text-xs font-medium text-(--earist-primary)">
                    {Math.round(
                      (getSignedCount(selectedReportData.panelists) /
                        selectedReportData.panelists.length) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-(--earist-border-gray)">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${(getSignedCount(selectedReportData.panelists) / selectedReportData.panelists.length) * 100}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              {selectedReportData.status === "pending" && (
                <Button onClick={() => handleDistribute(selectedReportData.id)} className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
                  <Send className="mr-2 h-4 w-4" />
                  Generate & Distribute
                </Button>
              )}
              {selectedReportData.status === "finalized" && (
                <>
                  <Button variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Student Copy (Watermarked)
                  </Button>
                  <Button className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
                    <Download className="mr-2 h-4 w-4" />
                    Official Copy
                  </Button>
                </>
              )}
              {(selectedReportData.status === "distributed" ||
                selectedReportData.status === "partial") && (
                <Button onClick={() => handleRemind(selectedReportData.id)} variant="outline" className="flex-1">
                  <Send className="mr-2 h-4 w-4" />
                  Resend Reminder
                </Button>
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
                    Click a report from the list to view details and manage
                    e-signatures.
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
