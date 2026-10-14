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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertCircle, ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  formatDefenseDate,
  formatDefenseTime,
  sessionStatusLabel,
} from "@/components/admin/defense-applications/labels";
import {
  defenseTypeLabel,
  stageFromDefenseType,
} from "@/components/admin/defense-scheduling/types";

const PAGE_SIZE = 10;
const ALL = "ALL";

interface DefenseRecordRow {
  scheduleId: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseType: string;
  defenseDate: string | null;
  defenseTime: string | null;
  sessionStatus: string;
  formalResult: string | null;
  summaryReady: boolean;
  rapStatus: string | null;
  recordStatus: "IN_PROGRESS" | "AWAITING_COMPLETION" | "COMPLETE" | string;
  recordStatusDetail: string | null;
}

interface DefenseRecordsResponse {
  data: DefenseRecordRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Session-status color is secondary; the text label is always rendered. */
const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  RESCHEDULED: "text-(--earist-secondary)",
  IN_PROGRESS: "text-(--earist-warning)",
  AWAITING_CONCLUSION: "text-(--earist-warning)",
  CONCLUDED: "text-(--earist-success)",
  CANCELLED: "text-destructive",
};

/** Formal academic result — never inferred from scores/session/record status. */
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

/** Record-completion projection (UI) — text label always rendered. */
const RECORD_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  AWAITING_COMPLETION: "Awaiting Completion",
  COMPLETE: "Complete",
};
const RECORD_STATUS_CLASS: Record<string, string> = {
  IN_PROGRESS: "text-(--earist-secondary)",
  AWAITING_COMPLETION: "text-(--earist-warning)",
  COMPLETE: "text-(--earist-success)",
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function studentSecondary(row: DefenseRecordRow): string {
  return [row.studentNumber, row.program].filter(Boolean).join(" · ");
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[25%]" />
          <col className="w-[13%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[18%]" />
          <col className="w-[9%]" />
        </colgroup>
        {children}
      </table>
    </div>
  );
}

const HEADERS = [
  "Student",
  "Defense Stage",
  "Defense Date",
  "Session Status",
  "Result",
  "Record Status",
] as const;

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
        {HEADERS.map((label) => (
          <th
            key={label}
            className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)"
          >
            {label}
          </th>
        ))}
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
              <Skeleton className="mt-2 h-3 w-16" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-24 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-20 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-24" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="ml-auto h-8 w-28 rounded-md" />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export default function AdminDefenseRecordsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [defenseTypeFilter, setDefenseTypeFilter] = useState(ALL);
  const [recordStatusFilter, setRecordStatusFilter] = useState(ALL);

  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const recordsQuery = useQuery<DefenseRecordsResponse>({
    queryKey: [
      "adminDefenseRecords",
      page,
      trimmedSearch,
      defenseTypeFilter,
      recordStatusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (defenseTypeFilter !== ALL) params.set("defenseType", defenseTypeFilter);
      if (recordStatusFilter !== ALL)
        params.set("recordStatus", recordStatusFilter);
      return (await apiClientRequest(
        `/thesis/defense/records?${params.toString()}`,
      )) as DefenseRecordsResponse;
    },
    placeholderData: keepPreviousData,
  });

  const isLoading = recordsQuery.isLoading;
  const isFetching = recordsQuery.isFetching;
  const isError = recordsQuery.isError;
  const isPlaceholderData = recordsQuery.isPlaceholderData;
  const hasData = recordsQuery.data != null;

  const filterRequestFailed = isError && isPlaceholderData;
  const loadFailedWithoutData = isError && !hasData;
  const sameQueryRefetchFailed = isError && hasData && !isPlaceholderData;

  const rows = recordsQuery.data?.data ?? [];
  const total = recordsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(effectivePage * PAGE_SIZE, total);

  // Bounded page-number window matching the accepted Admin list pattern
  // (Applicants / Students): all pages when <= 5, otherwise a rolling window of
  // up to 5 centred on the current page.
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

  const isFiltered =
    trimmedSearch !== "" || defenseTypeFilter !== ALL || recordStatusFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setDefenseTypeFilter(ALL);
    setRecordStatusFilter(ALL);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Defense Records"
        description="Review official defense sessions, academic results, and record completion."
      />

      {/* Compact operational filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="dr-search" className="sr-only">
            Search defense records
          </label>
          <Search
            className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)/60"
            aria-hidden="true"
          />
          <Input
            id="dr-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search student or student number…"
            className="pl-8"
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="dr-stage" className="sr-only">
            Defense stage
          </label>
          <select
            id="dr-stage"
            value={defenseTypeFilter}
            onChange={(e) => {
              setDefenseTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm"
          >
            <option value={ALL}>All Stages</option>
            <option value="TITLE_DEFENSE">Title Defense</option>
            <option value="PROPOSAL_DEFENSE">Proposal Defense</option>
            <option value="FINAL_DEFENSE">Final Defense</option>
          </select>
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="dr-status" className="sr-only">
            Record status
          </label>
          <select
            id="dr-status"
            value={recordStatusFilter}
            onChange={(e) => {
              setRecordStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm"
          >
            <option value={ALL}>All Records</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="AWAITING_COMPLETION">Awaiting Completion</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>
        {isFiltered && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {sameQueryRefetchFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh the list. Showing the most recent results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recordsQuery.refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Background-refresh notice: screen-reader only, zero layout space. */}
      <p className="sr-only" role="status" aria-live="polite">
        {isFetching && !isLoading ? "Updating defense records." : ""}
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
                  Unable to load defense records
                </p>
                <p className="text-sm text-(--earist-body-text)">
                  The records could not be loaded. Please try again.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => recordsQuery.refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
                  aria-hidden="true"
                />
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <p className="text-sm font-medium text-(--earist-primary)">
                {isFiltered
                  ? "No defense records match the selected filters."
                  : "No defense records found."}
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
                {rows.map((row) => {
                  const studentName = row.studentName ?? "—";
                  const secondary = studentSecondary(row);
                  const resultLabel = row.formalResult
                    ? RESULT_LABELS[row.formalResult] ??
                      row.formalResult.replace(/_/g, " ")
                    : null;
                  return (
                    <tr
                      key={row.scheduleId}
                      className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold break-words text-foreground">
                          {studentName}
                        </p>
                        {secondary && (
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {secondary}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm break-words text-(--earist-body-text)">
                          {defenseTypeLabel(stageFromDefenseType(row.defenseType))}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm break-words text-foreground">
                          {formatDefenseDate(row.defenseDate)}
                        </p>
                        {row.defenseTime && (
                          <p className="mt-0.5 text-xs tabular-nums text-(--earist-body-text)">
                            {formatDefenseTime(row.defenseTime)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            SESSION_BADGE_CLASS[row.sessionStatus.toUpperCase()],
                          )}
                        >
                          {sessionStatusLabel(row.sessionStatus)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {resultLabel ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium",
                              RESULT_BADGE_CLASS[row.formalResult ?? ""],
                            )}
                          >
                            {resultLabel}
                          </Badge>
                        ) : (
                          <span className="text-sm text-(--earist-body-text)">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            RECORD_STATUS_CLASS[row.recordStatus],
                          )}
                        >
                          {RECORD_STATUS_LABELS[row.recordStatus] ??
                            row.recordStatus.replace(/_/g, " ")}
                        </p>
                        {row.recordStatusDetail && (
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {row.recordStatusDetail}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <Link
                          href={`/admin/thesis/defense-records/${row.scheduleId}`}
                          aria-label={`View Record — ${studentName}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "ml-auto",
                          )}
                        >
                          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
                          View Record
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {from} to {to} of {total} record{total === 1 ? "" : "s"}
          </p>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Go to previous page"
                    onClick={() => setPage(Math.max(1, effectivePage - 1))}
                    disabled={effectivePage === 1 || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={
                        effectivePage === pageNumber ? "outline" : "ghost"
                      }
                      size="icon"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={
                        effectivePage === pageNumber ? "page" : undefined
                      }
                      onClick={() => setPage(pageNumber)}
                      disabled={isFetching}
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
                    onClick={() =>
                      setPage(Math.min(totalPages, effectivePage + 1))
                    }
                    disabled={effectivePage === totalPages || isFetching}
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
