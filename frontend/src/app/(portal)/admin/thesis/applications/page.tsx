"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import type { MissingRequirement, PaginatedResponse } from "@/types";
import { DefenseApplicationCard, type DefenseApplicationDto } from "@/components/admin/defense-applications/application-card";
import { DefenseApplicationReviewDialog } from "@/components/admin/defense-applications/review-dialog";
import { DefenseApplicationFilters } from "@/components/admin/defense-applications/filters";
import {
  HISTORY_STATUSES,
  STATUS_LABELS,
  statusFilterForView,
  type WorkflowView,
} from "@/components/admin/defense-applications/labels";

const WORKFLOW_TABS: Array<{ id: WorkflowView; label: string }> = [
  { id: "NEEDS_REVIEW", label: "Needs Review" },
  { id: "READY", label: "Ready for Scheduling" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "HISTORY", label: "History" },
];

export default function AdminDefenseApplicationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [view, setView] = useState<WorkflowView>("NEEDS_REVIEW");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("ALL");
  const [programId, setProgramId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reviewApp, setReviewApp] = useState<DefenseApplicationDto | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const res = await apiClientRequest("/programs");
      return Array.isArray(res) ? res : [];
    },
  });

  // Status is driven by the workflow tab unless the Admin overrides the filter.
  const effectiveStatus = useMemo(() => {
    if (statusFilter !== "ALL") return statusFilter;
    return statusFilterForView(view);
  }, [statusFilter, view]);

  const historyMode = view === "HISTORY" && statusFilter === "ALL";

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "defenseApplications",
      page,
      search,
      stage,
      effectiveStatus,
      historyMode,
      programId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        search,
        stage,
        programId,
        status: historyMode ? "HISTORY" : effectiveStatus,
      });
      const res = await apiClientRequest(
        `/thesis/defense/applications?${params.toString()}`,
      );
      return res as PaginatedResponse<DefenseApplicationDto>;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["defenseApplicationStats"],
    queryFn: async () => {
      const statuses = [
        "PENDING",
        "APPROVED",
        "SCHEDULED",
        "REJECTED",
        "PASSED",
        "REVISION",
        "FAILED",
      ] as const;
      const results = await Promise.all(
        statuses.map(async (status) => {
          const res = await apiClientRequest(
            `/thesis/defense/applications?page=1&pageSize=1&status=${status}`,
          );
          return [status, (res as { total: number }).total] as const;
        }),
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["defenseApplications"] });
    queryClient.invalidateQueries({ queryKey: ["defenseApplicationStats"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (thesisId: string) => {
      return apiClientRequest(`/thesis/defense/${thesisId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "APPROVED" }),
      });
    },
    onSuccess: () => {
      invalidate();
      setReviewApp(null);
      alert(
        "Application approved. The student is ready for panel assignment and scheduling.",
      );
    },
    onError: (error: Error & { missing?: MissingRequirement[] }) => {
      alert(
        error.missing?.length
          ? error.missing.map((m) => m.message).join("\n")
          : error.message || "The application could not be approved.",
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      thesisId,
      reason,
    }: {
      thesisId: string;
      reason: string;
    }) => {
      return apiClientRequest(`/thesis/defense/${thesisId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      invalidate();
      setReviewApp(null);
      alert("Application rejected. The student can correct and resubmit.");
    },
    onError: (error: Error) => {
      alert(error.message || "The application could not be rejected.");
    },
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const emptyMessage = (() => {
    if (search || stage !== "ALL" || programId !== "ALL" || statusFilter !== "ALL") {
      return "No defense applications match the selected filters.";
    }
    if (view === "NEEDS_REVIEW") {
      return "No defense applications are waiting for review.";
    }
    if (view === "READY") {
      return "No approved applications are waiting for scheduling.";
    }
    if (view === "SCHEDULED") {
      return "No scheduled defenses found.";
    }
    return "No historical defense applications found.";
  })();

  const primaryStats = [
    { key: "PENDING", label: STATUS_LABELS.PENDING, count: summary?.PENDING ?? 0 },
    { key: "APPROVED", label: STATUS_LABELS.APPROVED, count: summary?.APPROVED ?? 0 },
    { key: "SCHEDULED", label: STATUS_LABELS.SCHEDULED, count: summary?.SCHEDULED ?? 0 },
    { key: "REJECTED", label: STATUS_LABELS.REJECTED, count: summary?.REJECTED ?? 0 },
  ];

  const historyStats = HISTORY_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    count: summary?.[s] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Defense Application Review
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review Title, Proposal, and Final Defense applications. Approve only
          when requirements are complete — approval is not a passed defense.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {primaryStats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setView(
                s.key === "PENDING"
                  ? "NEEDS_REVIEW"
                  : s.key === "APPROVED"
                    ? "READY"
                    : s.key === "SCHEDULED"
                      ? "SCHEDULED"
                      : "HISTORY",
              );
              setStatusFilter(s.key === "REJECTED" ? "REJECTED" : "ALL");
              setPage(1);
            }}
            className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-left"
          >
            <p className="text-xs text-(--earist-body-text)">{s.label}</p>
            <p className="text-xl font-bold text-(--earist-primary)">{s.count}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-(--earist-body-text)">
        <span className="font-semibold">History:</span>
        {historyStats.map((s) => (
          <span key={s.key}>
            {s.label} {s.count}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-(--earist-border-gray) pb-2">
        {WORKFLOW_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={view === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setView(tab.id);
              setStatusFilter("ALL");
              setPage(1);
            }}
            className={
              view === tab.id
                ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                : ""
            }
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DefenseApplicationFilters
        search={search}
        stage={stage}
        status={statusFilter}
        programId={programId}
        programs={programs}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onStageChange={(v) => {
          setStage(v);
          setPage(1);
        }}
        onStatusChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onProgramChange={(v) => {
          setProgramId(v);
          setPage(1);
        }}
      />

      <div className="space-y-3">
        {isLoading && (
          <p className="py-10 text-center text-sm text-(--earist-body-text)">
            Loading defense applications...
          </p>
        )}
        {isError && (
          <p className="py-10 text-center text-sm text-red-600">
            Unable to load defense applications.
          </p>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <p className="py-10 text-center text-sm text-(--earist-body-text)">
            {emptyMessage}
          </p>
        )}
        {!isLoading &&
          items.map((app) => (
            <DefenseApplicationCard
              key={app.id}
              app={app}
              onView={() => setReviewApp(app)}
              onAssignSchedule={() =>
                router.push(`/admin/thesis/scheduling?thesisId=${app.id}`)
              }
            />
          ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
        <span>
          Showing {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <DefenseApplicationReviewDialog
        open={!!reviewApp}
        onOpenChange={(open) => {
          if (!open) setReviewApp(null);
        }}
        app={reviewApp}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id, reason) => rejectMutation.mutate({ thesisId: id, reason })}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
      />
    </div>
  );
}
