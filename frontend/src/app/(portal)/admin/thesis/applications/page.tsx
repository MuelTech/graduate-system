"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DefenseApplicationFilters } from "@/components/admin/defense-applications/filters";
import {
  DefenseApplicationRow,
  type DefenseApplicationDto,
} from "@/components/admin/defense-applications/application-row";
import {
  workflowBucketParam,
  type WorkflowView,
} from "@/components/admin/defense-applications/labels";
import type { PaginatedResponse, Program } from "@/types";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const PAGE_SIZE = 10;
const ALL = "ALL";

const WORKFLOW_TABS: Array<{ id: WorkflowView; label: string }> = [
  { id: "NEEDS_REVIEW", label: "Needs Review" },
  { id: "READY", label: "Ready for Scheduling" },
  { id: "SCHEDULED", label: "Scheduled / Active" },
  { id: "HISTORY", label: "History" },
];

type WorkflowSummary = {
  NEEDS_REVIEW: number;
  READY: number;
  ACTIVE: number;
  HISTORY: number;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[15%]" />
          <col className="w-[13%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col className="w-[17%]" />
        </colgroup>
        {children}
      </table>
    </div>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Student
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Defense Stage
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Submitted
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Documents
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Status
        </th>
        <th className="px-4 py-3 text-right text-xs font-semibold text-(--earist-body-text)">
          Action
        </th>
      </tr>
    </thead>
  );
}

function TableSkeleton() {
  return (
    <TableShell>
      <TableHead />
      <tbody aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <tr
            key={index}
            className="border-b border-(--earist-border-gray) last:border-0"
          >
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-32" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-24" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-24" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-24 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="ml-auto h-8 w-36 rounded-md" />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export default function AdminDefenseApplicationsPage() {
  const [view, setView] = useState<WorkflowView>("NEEDS_REVIEW");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(ALL);
  const [programId, setProgramId] = useState(ALL);

  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  // UIUX-2K: dedicated cache key for the graduate-program ARRAY shape. Other
  // Admin pages cache the full `/programs` DTO under `["programs"]`; sharing
  // that key caused `programs.map is not a function`.
  const programsQuery = useQuery<Program[]>({
    queryKey: ["programs", "graduate"],
    queryFn: async () => {
      const response = await apiClientRequest("/programs");
      return Array.isArray(response?.graduatePrograms)
        ? response.graduatePrograms
        : [];
    },
  });
  const programs = Array.isArray(programsQuery.data) ? programsQuery.data : [];

  const listBucket = workflowBucketParam(view);

  const applicationsQuery = useQuery<PaginatedResponse<DefenseApplicationDto>>({
    queryKey: [
      "defenseApplications",
      page,
      trimmedSearch,
      stage,
      listBucket,
      programId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        stage,
        programId,
        bucket: listBucket,
      });
      if (trimmedSearch) params.set("search", trimmedSearch);
      return (await apiClientRequest(
        `/thesis/defense/applications?${params.toString()}`,
      )) as PaginatedResponse<DefenseApplicationDto>;
    },
    placeholderData: keepPreviousData,
  });

  const summaryQuery = useQuery<WorkflowSummary>({
    queryKey: ["defenseWorkflowSummary", trimmedSearch, stage, programId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (stage !== ALL) params.set("stage", stage);
      if (programId !== ALL) params.set("programId", programId);
      const qs = params.toString();
      return (await apiClientRequest(
        `/thesis/defense/applications/summary${qs ? `?${qs}` : ""}`,
      )) as WorkflowSummary;
    },
  });

  const isLoading = applicationsQuery.isLoading;
  const isFetching = applicationsQuery.isFetching;
  const isError = applicationsQuery.isError;
  const isPlaceholderData = applicationsQuery.isPlaceholderData;
  const hasData = applicationsQuery.data != null;

  const filterRequestFailed = isError && isPlaceholderData;
  const loadFailedWithoutData = isError && !hasData;
  const sameQueryRefetchFailed = isError && hasData && !isPlaceholderData;

  const items = applicationsQuery.data?.data ?? [];
  const total = applicationsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(effectivePage * PAGE_SIZE, total);

  const isFiltered = trimmedSearch !== "" || stage !== ALL || programId !== ALL;

  const counts: Record<string, number> = {
    NEEDS_REVIEW: summaryQuery.data?.NEEDS_REVIEW ?? 0,
    READY: summaryQuery.data?.READY ?? 0,
    ACTIVE: summaryQuery.data?.ACTIVE ?? 0,
    HISTORY: summaryQuery.data?.HISTORY ?? 0,
  };

  const emptyMessage = (() => {
    if (isFiltered) return "No defense applications match the selected filters.";
    if (view === "NEEDS_REVIEW")
      return "No defense applications are waiting for review.";
    if (view === "READY")
      return "No approved applications are waiting for scheduling.";
    if (view === "SCHEDULED")
      return "No active defense applications are currently scheduled.";
    return "No application history found.";
  })();

  const clearFilters = () => {
    setSearch("");
    setStage(ALL);
    setProgramId(ALL);
    setPage(1);
  };

  const pageNumbers = (() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (effectivePage <= 3) return [1, 2, 3, 4, 5];
    if (effectivePage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
    return [
      effectivePage - 2,
      effectivePage - 1,
      effectivePage,
      effectivePage + 1,
      effectivePage + 2,
    ];
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Defense Applications"
        description="Review Title, Proposal, and Final Defense applications. Approved applications proceed to panel assignment and scheduling; approval is not a defense result."
      />

      {/* Workflow navigation (counts, not KPIs) */}
      <div
        role="group"
        aria-label="Application workflow"
        className="flex flex-wrap gap-2 border-b border-(--earist-border-gray) pb-2"
      >
        {WORKFLOW_TABS.map((tab) => {
          const isActive = view === tab.id;
          const count = counts[workflowBucketParam(tab.id)] ?? 0;
          return (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              aria-pressed={isActive}
              onClick={() => {
                setView(tab.id);
                setPage(1);
              }}
              className={cn(
                isActive &&
                  "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-xs font-semibold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-(--earist-surface-gray) text-(--earist-body-text)",
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <DefenseApplicationFilters
        search={search}
        stage={stage}
        programId={programId}
        programs={programs}
        programsLoading={programsQuery.isLoading}
        programsError={programsQuery.isError}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onStageChange={(v) => {
          setStage(v);
          setPage(1);
        }}
        onProgramChange={(v) => {
          setProgramId(v);
          setPage(1);
        }}
        onClear={clearFilters}
      />

      {sameQueryRefetchFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh the list. Showing the most recent results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applicationsQuery.refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Background-refresh notice: screen-reader only, zero visual/layout space. */}
      <p className="sr-only" role="status" aria-live="polite">
        {isFetching && !isLoading ? "Updating defense applications." : ""}
      </p>

      <Card className="overflow-hidden py-0">
        <CardContent className="min-w-0 p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : filterRequestFailed || loadFailedWithoutData ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <AlertCircle
                className="h-8 w-8 text-(--earist-secondary)"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  Unable to load defense applications
                </p>
                <p className="text-sm text-(--earist-body-text)">
                  The applications for the current view could not be loaded.
                  Please try again.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applicationsQuery.refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
                  aria-hidden="true"
                />
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="text-sm font-medium text-(--earist-primary)">
                {emptyMessage}
              </p>
              {isFiltered && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {items.map((app) => (
                  <DefenseApplicationRow key={app.id} app={app} />
                ))}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {from}–{to} of {total} application{total === 1 ? "" : "s"}
          </p>
          {totalPages > 1 && (
            <nav aria-label="pagination" className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to previous page"
                onClick={() => setPage(Math.max(1, effectivePage - 1))}
                disabled={effectivePage === 1}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={effectivePage === pageNumber ? "outline" : "ghost"}
                  size="icon"
                  aria-label={`Go to page ${pageNumber}`}
                  aria-current={
                    effectivePage === pageNumber ? "page" : undefined
                  }
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to next page"
                onClick={() => setPage(Math.min(totalPages, effectivePage + 1))}
                disabled={effectivePage === totalPages}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
