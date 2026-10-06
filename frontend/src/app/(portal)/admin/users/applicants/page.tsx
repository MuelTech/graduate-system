"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import type {
  AdminApplicantListRow,
  AdminApplicantStage,
  Program,
} from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Eye,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

type StageFilter = "ALL" | AdminApplicantStage;

const STAGE_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: "ALL", label: "All Stages" },
  { value: "ALIGNMENT", label: "Program Alignment" },
  { value: "EXAM", label: "Entrance Examination" },
  { value: "COR", label: "COR / Enrollment" },
];

const ALL_PROGRAMS = "ALL";

/* --------------------------------------------------------------- utilities */

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function alignmentIsComplete(status: string | null): boolean {
  return status === "ALIGNED" || status === "CLEARED";
}

type StepState = "COMPLETE" | "CURRENT" | "WAITING";

/** Concise, human-readable current admission condition (no raw enums). */
function currentStateLabel(row: AdminApplicantListRow): string {
  if (row.admissionStage === "ALIGNMENT") {
    return row.alignmentStatus === "PENDING_WAIVER"
      ? "Bridging waiver pending"
      : "Alignment status unavailable";
  }

  if (row.admissionStage === "EXAM") {
    switch (row.examStatus) {
      case "NOT_SCHEDULED":
        return "Ready to schedule entrance exam";
      case "PENDING":
        return "Entrance exam scheduled";
      case "APPROVED":
        return "Entrance exam approved";
      case "TAKEN":
        return "Entrance exam awaiting grading";
      case "APPEALED":
        return "Exam appeal awaiting review";
      case "FAILED":
        return "Entrance exam failed";
      case "DISQUALIFIED":
        return "Disqualified from entrance exam";
      default:
        return "Entrance examination in progress";
    }
  }

  switch (row.corStatus) {
    case "NONE":
      return "Exam passed — awaiting COR upload";
    case "PENDING":
      return "COR awaiting verification";
    case "REJECTED":
      return "COR rejected — awaiting resubmission";
    case "VERIFIED":
      return "COR verified";
    default:
      return "COR / enrollment in progress";
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------- components */

function StepMarker({ state }: { state: StepState }) {
  if (state === "COMPLETE") {
    return (
      <CheckCircle2
        className="h-4 w-4 shrink-0 text-(--earist-success)"
        aria-hidden="true"
      />
    );
  }
  if (state === "CURRENT") {
    return (
      <CircleDot
        className="h-4 w-4 shrink-0 text-(--earist-primary)"
        aria-hidden="true"
      />
    );
  }
  return (
    <Clock
      className="h-4 w-4 shrink-0 text-(--earist-body-text)/50"
      aria-hidden="true"
    />
  );
}

const STEP_STATE_WORD: Record<StepState, string> = {
  COMPLETE: "complete",
  CURRENT: "current",
  WAITING: "waiting",
};

function AdmissionProgress({ row }: { row: AdminApplicantListRow }) {
  const alignmentComplete = alignmentIsComplete(row.alignmentStatus);
  const steps: { key: string; label: string; state: StepState }[] = [
    {
      key: "alignment",
      label: "Alignment",
      state: alignmentComplete ? "COMPLETE" : "CURRENT",
    },
    {
      key: "exam",
      label: "Exam",
      state: !alignmentComplete
        ? "WAITING"
        : row.hasPassedExam
          ? "COMPLETE"
          : "CURRENT",
    },
    {
      key: "cor",
      label: "COR",
      state: row.hasPassedExam ? "CURRENT" : "WAITING",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((step, index) => (
        <span key={step.key} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <ChevronRight
              className="h-3 w-3 text-(--earist-body-text)/40"
              aria-hidden="true"
            />
          )}
          <StepMarker state={step.state} />
          <span
            className={cn(
              "text-xs",
              step.state === "CURRENT"
                ? "font-semibold text-(--earist-primary)"
                : "text-(--earist-body-text)",
            )}
          >
            {step.label}
          </span>
          <span className="sr-only">{STEP_STATE_WORD[step.state]}</span>
        </span>
      ))}
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[20%]" />
          <col className="w-[24%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col className="w-[6%]" />
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
          Applicant
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Program
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Admission Progress
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Current State
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Registered
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
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-2 h-3 w-40" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-40" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-32" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-20" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="ml-auto h-8 w-8 rounded-md" />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {filtered ? (
        <Search className="h-8 w-8 text-(--earist-body-text)/40" aria-hidden="true" />
      ) : (
        <Users className="h-8 w-8 text-(--earist-body-text)/40" aria-hidden="true" />
      )}
      <p className="text-sm font-medium text-(--earist-primary)">
        {filtered
          ? "No applicants match the current filters."
          : "No active applicants."}
      </p>
      <p className="max-w-sm text-sm text-(--earist-body-text)">
        {filtered
          ? "Try a different search term, program, or admission stage."
          : "Applicants still progressing through admission will appear here."}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function ErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <AlertCircle className="h-8 w-8 text-(--earist-secondary)" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Unable to load applicants
        </p>
        <p className="text-sm text-(--earist-body-text)">
          The applicant list for the current view could not be loaded. Please
          try again.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw
          className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
          aria-hidden="true"
        />
        Retry
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdminApplicantsPage() {
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState<string>(ALL_PROGRAMS);
  const [stage, setStage] = useState<StageFilter>("ALL");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const programsQuery = useQuery({
    queryKey: ["programs"],
    queryFn: async () => apiClientRequest("/programs"),
  });
  const graduatePrograms: Program[] = programsQuery.data?.graduatePrograms ?? [];

  const applicantsQuery = useQuery({
    queryKey: ["adminApplicants", page, trimmedSearch, programId, stage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (programId !== ALL_PROGRAMS) params.set("programId", programId);
      if (stage !== "ALL") params.set("stage", stage);
      return apiClientRequest(`/admin/applicants?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const isLoading = applicantsQuery.isLoading;
  const isFetching = applicantsQuery.isFetching;
  const isError = applicantsQuery.isError;
  const isPlaceholderData = applicantsQuery.isPlaceholderData;
  const isPaused = applicantsQuery.fetchStatus === "paused";
  const hasData = applicantsQuery.data != null;

  // Query-key-scoped data only. A different filter/search/page is a different
  // query key: while that request is in flight its previous-key rows may remain
  // for layout stability, but once it fails or is paused we must NOT present
  // unrelated rows as the result of the newly selected filter.
  const filterRequestFailed = (isError || isPaused) && isPlaceholderData;
  const loadFailedWithoutData = isError && !hasData;
  // A same-query background refetch failure may retain its own usable rows.
  const sameQueryRefetchFailed =
    (isError || isPaused) && hasData && !isPlaceholderData;

  const rows: AdminApplicantListRow[] = applicantsQuery.data?.applicants ?? [];
  const total: number = applicantsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered =
    trimmedSearch !== "" || programId !== ALL_PROGRAMS || stage !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setProgramId(ALL_PROGRAMS);
    setStage("ALL");
    setPage(1);
  };

  const programLabel =
    programId === ALL_PROGRAMS
      ? "All Programs"
      : (graduatePrograms.find((program) => program.id === programId)
          ?.programName ?? "All Programs");
  const stageLabel =
    STAGE_OPTIONS.find((option) => option.value === stage)?.label ??
    "All Stages";

  const pageNumbers = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2)
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    return [page - 2, page - 1, page, page + 1, page + 2];
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Monitor active applicants and their progress from program alignment through entrance examination and COR verification."
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label
                htmlFor="applicant-search"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Search
              </label>
              <div className="relative">
                <Search
                  className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)/60"
                  aria-hidden="true"
                />
                <Input
                  id="applicant-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, email, or Pinnacle ID"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-full sm:w-72">
              <label
                htmlFor="filter-program"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Program
              </label>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value ?? ALL_PROGRAMS);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-program" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={programLabel}
                  >
                    {programLabel}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[min(92vw,24rem)]">
                  <SelectItem
                    value={ALL_PROGRAMS}
                    className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                  >
                    All Programs
                  </SelectItem>
                  {graduatePrograms.map((program) => (
                    <SelectItem
                      key={program.id}
                      value={program.id}
                      className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                    >
                      {program.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-48">
              <label
                htmlFor="filter-stage"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Admission Stage
              </label>
              <Select
                value={stage}
                onValueChange={(value) => {
                  setStage((value as StageFilter) ?? "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-stage" className="w-full">
                  <span className="flex-1 truncate text-left" title={stageLabel}>
                    {stageLabel}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto sm:pb-0.5">
              {isFetching && !isLoading && (
                <span className="text-xs text-(--earist-body-text)" role="status">
                  Updating…
                </span>
              )}
              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Same-query background refetch failure: keep usable rows + restrained feedback */}
      {sameQueryRefetchFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh the list. Showing the most recent results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applicantsQuery.refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {/* List */}
      <Card className="overflow-hidden py-0">
        <CardContent className="min-w-0 p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : filterRequestFailed || loadFailedWithoutData ? (
            <ErrorState
              onRetry={() => applicantsQuery.refetch()}
              retrying={isFetching}
            />
          ) : rows.length === 0 ? (
            <EmptyState filtered={isFiltered} onClear={clearFilters} />
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {rows.map((applicant) => (
                  <tr
                    key={applicant.id}
                    className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-semibold break-words text-foreground">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                        {applicant.pinnacleApplicantId || "No Pinnacle ID"}
                      </p>
                      <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                        {applicant.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {applicant.program?.programName ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AdmissionProgress row={applicant} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {currentStateLabel(applicant)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs whitespace-nowrap text-(--earist-body-text)">
                        {formatDate(applicant.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Link
                        href={`/admin/users/applicants/${applicant.id}`}
                        aria-label={`View applicant ${applicant.firstName} ${applicant.lastName}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "ml-auto",
                        )}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, total)} of {total} applicant
            {total === 1 ? "" : "s"}
          </p>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Go to previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={page === pageNumber ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={page === pageNumber ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Go to next page"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
