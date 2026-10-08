"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { PanelistAssignmentData } from "@/types";
import {
  ALL,
  assignmentAction,
  defenseStageLabel,
  filterAssignments,
  formatWallDate,
  formatWallTime,
  isoToWallDate,
  isoToWallTime,
  nowWallMs,
  responsibilityText,
  sessionStatusLabel,
} from "@/lib/panelist-defenses";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

const NO_ASSIGNMENTS: PanelistAssignmentData[] = [];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All Stages" },
  { value: "TITLE_DEFENSE", label: "Title" },
  { value: "PROPOSAL_DEFENSE", label: "Proposal" },
  { value: "FINAL_DEFENSE", label: "Final" },
];

const SESSION_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All Sessions" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "AWAITING_CONCLUSION", label: "Awaiting formal conclusion" },
  { value: "CONCLUDED", label: "Concluded" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "text-(--earist-body-text)",
  IN_PROGRESS: "text-(--earist-warning)",
  AWAITING_CONCLUSION: "text-(--earist-secondary)",
  CONCLUDED: "text-(--earist-success)",
  CANCELLED: "text-(--earist-body-text)/70",
};

/* ------------------------------------------------------------- components */

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[17%]" />
          <col className="w-[17%]" />
          <col className="w-[16%]" />
          <col className="w-[18%]" />
          <col className="w-[8%]" />
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
          Defense
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Schedule
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Session Status
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          My Responsibility
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
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-24 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-28" />
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
        <Search
          className="h-8 w-8 text-(--earist-body-text)/40"
          aria-hidden="true"
        />
      ) : (
        <Inbox
          className="h-8 w-8 text-(--earist-body-text)/40"
          aria-hidden="true"
        />
      )}
      <p className="text-sm font-medium text-(--earist-primary)">
        {filtered
          ? "No assigned defenses match the current filters."
          : "You have no assigned defenses."}
      </p>
      <p className="max-w-sm text-sm text-(--earist-body-text)">
        {filtered
          ? "Try a different search term, defense stage, or session status."
          : "Defense sessions assigned to you will appear here."}
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
      <AlertCircle
        className="h-8 w-8 text-(--earist-secondary)"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Unable to load your assigned defenses
        </p>
        <p className="text-sm text-(--earist-body-text)">
          Your defense assignments could not be loaded. Please try again.
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

export default function PanelistDefensesPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [session, setSession] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  // Snapshot "now" once per mount so ordering/filtering stay stable across renders.
  const nowMs = useMemo(() => nowWallMs(), []);

  const assignmentsQuery = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? (res as PanelistAssignmentData[]) : [];
    },
  });

  const assignments = assignmentsQuery.data ?? NO_ASSIGNMENTS;
  const isLoading = assignmentsQuery.isLoading;
  const isFetching = assignmentsQuery.isFetching;
  const isError = assignmentsQuery.isError;
  const hasData = assignmentsQuery.data != null;

  const filtered = useMemo(
    () => filterAssignments(assignments, { search, stage, session }, nowMs),
    [assignments, search, stage, session, nowMs],
  );

  const isFiltered = search.trim() !== "" || stage !== ALL || session !== ALL;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const clearFilters = () => {
    setSearch("");
    setStage(ALL);
    setSession(ALL);
    setPage(1);
  };

  const stageLabelText =
    STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? "All Stages";
  const sessionLabelText =
    SESSION_OPTIONS.find((o) => o.value === session)?.label ?? "All Sessions";

  const pageNumbers = (() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5];
    if (safePage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Defenses"
        description="View your assigned defense sessions and complete your academic responsibilities."
      />

      {/* Search and filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label
                htmlFor="defense-search"
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
                  id="defense-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by student name, number, or program..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-full sm:w-52">
              <label
                htmlFor="filter-stage"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Defense Stage
              </label>
              <Select
                value={stage}
                onValueChange={(value) => {
                  setStage(value ?? ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-stage" className="w-full">
                  <span className="flex-1 truncate text-left">
                    {stageLabelText}
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

            <div className="w-full sm:w-60">
              <label
                htmlFor="filter-session"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Session Status
              </label>
              <Select
                value={session}
                onValueChange={(value) => {
                  setSession(value ?? ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-session" className="w-full">
                  <span className="flex-1 truncate text-left">
                    {sessionLabelText}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {SESSION_OPTIONS.map((option) => (
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

      {/* Keep usable rows + feedback when a background refresh fails */}
      {isError && hasData && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh your assignments. Showing the most recent
            results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => assignmentsQuery.refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Assignment registry */}
      <Card className="overflow-hidden py-0">
        <CardContent className="min-w-0 p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError && !hasData ? (
            <ErrorState
              onRetry={() => assignmentsQuery.refetch()}
              retrying={isFetching}
            />
          ) : assignments.length === 0 ? (
            <EmptyState filtered={false} onClear={clearFilters} />
          ) : filtered.length === 0 ? (
            <EmptyState filtered onClear={clearFilters} />
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {pageItems.map((assignment) => {
                  const schedule = assignment.schedule;
                  const student = schedule?.thesis?.student;
                  const scheduleId = schedule?.id;
                  const action = assignmentAction(assignment);
                  const wallDate = isoToWallDate(schedule?.defenseDate);
                  const wallTime = isoToWallTime(schedule?.defenseTime);
                  const status = String(schedule?.sessionStatus ?? "");
                  const hasSchedule = wallDate !== null && wallTime !== null;

                  return (
                    <tr
                      key={assignment.id}
                      className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold break-words text-foreground">
                          {student?.user?.firstName} {student?.user?.lastName}
                        </p>
                        {student?.studentNumber ? (
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {student.studentNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm break-words text-foreground">
                          {defenseStageLabel(schedule?.defenseType)} Defense
                        </p>
                        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                          {student?.program?.programName ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {hasSchedule ? (
                          <>
                            <p className="text-sm break-words text-foreground">
                              {formatWallDate(wallDate)}
                            </p>
                            <p className="mt-0.5 text-xs text-(--earist-body-text)">
                              {formatWallTime(wallTime)}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-(--earist-body-text)">
                            Not scheduled yet
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            SESSION_BADGE_CLASS[status] ??
                              "text-(--earist-body-text)",
                          )}
                        >
                          {sessionStatusLabel(status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm break-words text-(--earist-body-text)">
                          {responsibilityText(assignment)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        {action.kind === "workspace" && scheduleId ? (
                          <Link
                            href={`/panelist/defense-workspace/${scheduleId}`}
                            aria-label={`${action.label} for ${student?.user?.firstName ?? ""} ${student?.user?.lastName ?? ""}`.trim()}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "whitespace-nowrap",
                            )}
                          >
                            {action.label}
                            <ChevronRight
                              className="ml-1 h-4 w-4"
                              aria-hidden="true"
                            />
                          </Link>
                        ) : (
                          <span className="text-xs text-(--earist-body-text)/70">
                            {action.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {(safePage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(safePage * PAGE_SIZE, total)} of {total} assigned defense
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
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={safePage === pageNumber ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={safePage === pageNumber ? "page" : undefined}
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
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                    disabled={safePage === totalPages}
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
