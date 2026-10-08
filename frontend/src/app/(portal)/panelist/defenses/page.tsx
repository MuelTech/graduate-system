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
import {
  ManuscriptDialog,
  type ManuscriptTarget,
} from "@/components/panelist/manuscript-dialog";
import type { PanelistAssignmentData } from "@/types";
import {
  ALL,
  QUICK_FILTERS,
  assignmentAction,
  defenseStageLabel,
  filterAssignments,
  formatWallDate,
  formatWallTime,
  isEvaluationRelevant,
  isMeetingJoinActive,
  isoToWallDate,
  isoToWallTime,
  nowWallMs,
  resolveVenue,
  responsibilityText,
  roleLabel,
  sessionStatusLabel,
  type QuickFilter,
  type VenueResolution,
} from "@/lib/panelist-defenses";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Inbox,
  MapPin,
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

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3 w-72 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-36" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
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
            ? "Try a different quick filter, search term, defense stage, or session status."
            : "Defense sessions assigned to you will appear here."}
        </p>
        {filtered && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
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
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------- card fragments */

function MetaItem({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-(--earist-body-text)">{label}</dt>
      <dd className="mt-0.5 font-medium break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

function VenueContent({
  venue,
  active,
  studentName,
}: {
  venue: VenueResolution;
  active: boolean;
  studentName: string;
}) {
  if (venue.kind === "none") {
    return (
      <span className="font-normal text-(--earist-body-text)">
        Venue / meeting details not provided
      </span>
    );
  }

  if (venue.kind === "physical") {
    return (
      <span className="flex items-start gap-1.5 font-normal">
        <MapPin
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--earist-body-text)"
          aria-hidden="true"
        />
        <span className="break-words">{venue.text}</span>
      </span>
    );
  }

  // A valid online meeting URL. Only live sessions expose an active Join action;
  // inactive sessions preserve the recorded link as muted, non-clickable context.
  if (active) {
    return (
      <a
        href={venue.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Join online meeting for ${studentName}`}
        className="inline-flex items-center gap-1.5 font-medium break-all text-(--earist-secondary) hover:underline focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Join Meeting
      </a>
    );
  }

  return (
    <span className="flex items-start gap-1.5 font-normal text-(--earist-body-text)">
      <ExternalLink
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      />
      <span className="break-all">{venue.url}</span>
    </span>
  );
}

/* ------------------------------------------------------------------- page */

export default function PanelistDefensesPage() {
  const [quick, setQuick] = useState<QuickFilter>("ALL");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [session, setSession] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [manuscript, setManuscript] = useState<ManuscriptTarget | null>(null);

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
    () =>
      filterAssignments(
        assignments,
        { quick, search, stage, session },
        nowMs,
      ),
    [assignments, quick, search, stage, session, nowMs],
  );

  const isFiltered =
    quick !== "ALL" || search.trim() !== "" || stage !== ALL || session !== ALL;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const clearFilters = () => {
    setQuick("ALL");
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
        description="View your assigned defense sessions and complete your responsibilities."
      />

      {/* Search and filters */}
      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Quick filters — presentation shortcuts, not academic authority. */}
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label="Quick filters"
              className="flex w-fit flex-wrap gap-1 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-1"
            >
              {QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={quick === filter.value}
                  onClick={() => {
                    setQuick(filter.value);
                    // Quick filters own the session-level narrowing; clear the
                    // advanced Session Status so the two never contradict.
                    setSession(ALL);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none",
                    quick === filter.value
                      ? "bg-white text-(--earist-primary) shadow-sm"
                      : "text-(--earist-body-text) hover:bg-white/60",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

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
                  // A specific session status supersedes the quick filter.
                  setQuick("ALL");
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
      {isLoading ? (
        <ListSkeleton />
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
        <div className="space-y-3">
          {pageItems.map((assignment) => {
            const schedule = assignment.schedule;
            const student = schedule?.thesis?.student;
            const scheduleId = schedule?.id;
            const action = assignmentAction(assignment);
            const wallDate = isoToWallDate(schedule?.defenseDate);
            const wallTime = isoToWallTime(schedule?.defenseTime);
            const status = String(schedule?.sessionStatus ?? "");
            const hasSchedule = wallDate !== null && wallTime !== null;
            const isCancelled = status === "CANCELLED";
            const venue = resolveVenue(schedule?.venueOrLink);
            const meetingActive = isMeetingJoinActive(status);
            const evalRelevant = isEvaluationRelevant(assignment);
            const studentName =
              `${student?.user?.firstName ?? ""} ${student?.user?.lastName ?? ""}`.trim() ||
              "Student";
            const identityMeta = [
              student?.studentNumber,
              student?.program?.programName,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Card key={assignment.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    {/* Primary identity + session status */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold break-words text-foreground">
                          {studentName}
                        </p>
                        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                          {identityMeta || "—"}
                        </p>
                      </div>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-(--earist-body-text)">
                          Session Status:
                        </span>
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
                      </span>
                    </div>

                    {/* Grouped metadata: context, schedule, location, responsibility */}
                    <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                      <MetaItem label="Defense">
                        {defenseStageLabel(schedule?.defenseType)} Defense
                      </MetaItem>
                      <MetaItem label="Role">
                        {roleLabel(assignment.role)}
                      </MetaItem>
                      <MetaItem label="Schedule">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {hasSchedule
                            ? `${formatWallDate(wallDate)} · ${formatWallTime(wallTime)}`
                            : "Not scheduled yet"}
                        </span>
                      </MetaItem>
                      <MetaItem
                        label={
                          venue.kind === "online"
                            ? "Online Meeting"
                            : "Defense Venue"
                        }
                        className="sm:col-span-3"
                      >
                        <VenueContent
                          venue={venue}
                          active={meetingActive}
                          studentName={studentName}
                        />
                      </MetaItem>
                      {evalRelevant ? (
                        <MetaItem
                          label="My Responsibility"
                          className="sm:col-span-3"
                        >
                          {responsibilityText(assignment)}
                        </MetaItem>
                      ) : null}
                    </dl>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                    {action.kind === "workspace" && scheduleId ? (
                      <Link
                        href={`/panelist/defense-workspace/${scheduleId}`}
                        aria-label={`${action.label} for ${studentName}`}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "justify-center whitespace-nowrap",
                        )}
                      >
                        {action.label}
                        <ChevronRight
                          className="ml-1 h-4 w-4"
                          aria-hidden="true"
                        />
                      </Link>
                    ) : (
                      <span className="self-start text-xs text-(--earist-body-text)/70">
                        {action.label}
                      </span>
                    )}

                    {!isCancelled && scheduleId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() =>
                          setManuscript({ scheduleId, studentName })
                        }
                      >
                        <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        View Manuscript
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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

      <ManuscriptDialog
        target={manuscript}
        onClose={() => setManuscript(null)}
      />
    </div>
  );
}
