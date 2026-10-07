"use client";

import { useState } from "react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiApplication, Program } from "@/types";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;
const ALL = "ALL";
const MISSING = "—";

/* ------------------------------------------------------------ exam state */

type ExamStateKey =
  | "SCHEDULED"
  | "NEEDS_GRADING"
  | "PASSED"
  | "FAILED"
  | "APPEAL_PENDING"
  | "DISQUALIFIED"
  | "UNKNOWN";

type ExamStateFilter = "ALL" | Exclude<ExamStateKey, "UNKNOWN">;

/**
 * Presentation-only projection of the authoritative `ExamAppStatus`.
 * Never persisted; no new domain state is introduced.
 */
function deriveExamState(status: string): ExamStateKey {
  switch (status) {
    case "PENDING":
    case "APPROVED":
      return "SCHEDULED";
    case "TAKEN":
      return "NEEDS_GRADING";
    case "PASSED":
      return "PASSED";
    case "FAILED":
      return "FAILED";
    case "APPEALED":
      return "APPEAL_PENDING";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    default:
      return "UNKNOWN";
  }
}

const STATE_LABEL: Record<ExamStateKey, string> = {
  SCHEDULED: "Scheduled",
  NEEDS_GRADING: "Needs Essay Grading",
  PASSED: "Passed",
  FAILED: "Failed",
  APPEAL_PENDING: "Appeal Pending",
  DISQUALIFIED: "Disqualified",
  UNKNOWN: "Unknown",
};

/** Border-first, text-carrying badge. Color is never the only signal. */
const STATE_BADGE_CLASS: Record<ExamStateKey, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  NEEDS_GRADING: "text-(--earist-warning)",
  PASSED: "text-(--earist-success)",
  FAILED: "text-destructive",
  APPEAL_PENDING: "text-(--earist-warning)",
  DISQUALIFIED: "text-(--earist-body-text)",
  UNKNOWN: "text-(--earist-body-text)",
};

const STATE_FILTERS: { value: ExamStateFilter; label: string }[] = [
  { value: "ALL", label: "All States" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "NEEDS_GRADING", label: "Needs Essay Grading" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" },
  { value: "APPEAL_PENDING", label: "Appeal Pending" },
  { value: "DISQUALIFIED", label: "Disqualified" },
];

/* -------------------------------------------------------------- formatting */

/** Parse a wall-clock ISO date without a UTC->local day shift. */
function formatExamDate(iso: string | null): string {
  if (!iso) return MISSING;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return MISSING;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatExamTime(iso: string | null): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* --------------------------------------------------------------- row model */

interface ExamRecordRow {
  id: string;
  name: string;
  email: string;
  pinnacleId: string;
  programId: string | null;
  programName: string;
  examDate: string | null;
  examTime: string | null;
  state: ExamStateKey;
}

function toRow(app: ApiApplication): ExamRecordRow {
  return {
    id: app.id,
    name: `${app.student.user.firstName} ${app.student.user.lastName}`.trim(),
    email: app.student.user.email ?? "",
    pinnacleId: app.student.pinnacleApplicantId || "",
    programId: app.program?.id ?? null,
    programName: app.program?.programName ?? MISSING,
    examDate: app.slot?.examDate ?? null,
    examTime: app.slot?.examTime ?? null,
    state: deriveExamState(app.status),
  };
}

/* -------------------------------------------------------------- table parts */

function StateBadge({ state }: { state: ExamStateKey }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATE_BADGE_CLASS[state])}>
      {STATE_LABEL[state]}
    </Badge>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[26%]" />
          <col className="w-[22%]" />
          <col className="w-[16%]" />
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
          Applicant
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Program
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Exam Schedule
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Exam State
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
              <Skeleton className="h-4 w-32" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-28 rounded-full" />
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
        <CalendarClock
          className="h-8 w-8 text-(--earist-body-text)/40"
          aria-hidden="true"
        />
      )}
      <p className="text-sm font-medium text-(--earist-primary)">
        {filtered
          ? "No exam records match the current filters."
          : "No entrance exam records yet."}
      </p>
      <p className="max-w-sm text-sm text-(--earist-body-text)">
        {filtered
          ? "Try a different search term, program, or exam state."
          : "Records appear here once applicants select an entrance exam slot."}
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
          Unable to load entrance exam records
        </p>
        <p className="text-sm text-(--earist-body-text)">
          The exam records could not be loaded. Please try again.
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

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-(--earist-body-text)">{label}</dt>
      <dd className="text-sm font-medium break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function ExamRecordsPage() {
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState(ALL);
  const [examState, setExamState] = useState<ExamStateFilter>("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ExamRecordRow | null>(null);

  const recordsQuery = useQuery<ApiApplication[]>({
    queryKey: ["examRecords"],
    queryFn: () => apiClientRequest("/exam/applications"),
  });

  const programsQuery = useQuery<{ graduatePrograms: Program[] }>({
    queryKey: ["programs"],
    queryFn: () => apiClientRequest("/programs"),
  });
  const programs: Program[] = programsQuery.data?.graduatePrograms ?? [];

  const isLoading = recordsQuery.isLoading;
  const isFetching = recordsQuery.isFetching;
  const isError = recordsQuery.isError;

  const records: ExamRecordRow[] = (recordsQuery.data ?? []).map(toRow);

  const query = search.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const matchesSearch =
      query === "" ||
      record.name.toLowerCase().includes(query) ||
      record.email.toLowerCase().includes(query) ||
      record.pinnacleId.toLowerCase().includes(query);
    const matchesProgram = programId === ALL || record.programId === programId;
    const matchesState = examState === "ALL" || record.state === examState;
    return matchesSearch && matchesProgram && matchesState;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const isFiltered =
    search.trim() !== "" || programId !== ALL || examState !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setProgramId(ALL);
    setExamState("ALL");
    setPage(1);
  };

  const programLabel =
    programId === ALL
      ? "All Programs"
      : (programs.find((program) => program.id === programId)?.programName ??
        "All Programs");
  const examStateLabel =
    STATE_FILTERS.find((option) => option.value === examState)?.label ??
    "All States";

  const pageNumbers = (() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ];
  })();

  const isScoreState =
    selected?.state === "PASSED" || selected?.state === "FAILED";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrance Exam Records"
        description="Monitor entrance exam schedules, grading progress, and results."
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label
                htmlFor="exam-record-search"
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
                  id="exam-record-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, email, or Pinnacle ID"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-full sm:w-72">
              <label
                htmlFor="exam-record-program"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Program
              </label>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value ?? ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger id="exam-record-program" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={programLabel}
                  >
                    {programLabel}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[min(92vw,24rem)]">
                  <SelectItem
                    value={ALL}
                    className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                  >
                    All Programs
                  </SelectItem>
                  {programs.map((program) => (
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

            <div className="w-full sm:w-52">
              <label
                htmlFor="exam-record-state"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Exam State
              </label>
              <Select
                value={examState}
                onValueChange={(value) => {
                  setExamState((value as ExamStateFilter) ?? "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger id="exam-record-state" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={examStateLabel}
                  >
                    {examStateLabel}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STATE_FILTERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto sm:pb-0.5">
              {isFetching && !isLoading && (
                <span
                  className="text-xs text-(--earist-body-text)"
                  role="status"
                >
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

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <CardContent className="min-w-0 p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <ErrorState
              onRetry={() => recordsQuery.refetch()}
              retrying={isFetching}
            />
          ) : records.length === 0 ? (
            <EmptyState filtered={false} onClear={clearFilters} />
          ) : filtered.length === 0 ? (
            <EmptyState filtered onClear={clearFilters} />
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {pageRows.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-semibold break-words text-foreground">
                        {record.name || MISSING}
                      </p>
                      <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                        {record.pinnacleId || "No Pinnacle ID"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {record.programName}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {record.examDate ? (
                        <>
                          <p className="text-sm text-(--earist-body-text)">
                            {formatExamDate(record.examDate)}
                          </p>
                          <p className="mt-0.5 text-xs whitespace-nowrap text-(--earist-body-text)">
                            {formatExamTime(record.examTime)}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm text-(--earist-body-text)">
                          {MISSING}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StateBadge state={record.state} />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelected(record)}
                        aria-label={`View exam record for ${record.name || "applicant"}`}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, total)} of {total} exam record
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
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={currentPage === pageNumber ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={
                        currentPage === pageNumber ? "page" : undefined
                      }
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
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* Transitional read-only exam record summary */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exam Record</DialogTitle>
            <DialogDescription>
              Read-only summary. Grading and result operations are handled in
              their owning modules.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold break-words text-foreground">
                  {selected.name || MISSING}
                </p>
                <p className="mt-0.5 text-xs text-(--earist-body-text)">
                  {selected.pinnacleId || "No Pinnacle ID"}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem label="Program">
                  {selected.programName}
                </DetailItem>
                <DetailItem label="Exam Schedule">
                  {selected.examDate ? (
                    <>
                      {formatExamDate(selected.examDate)}
                      <span className="text-(--earist-body-text)">
                        {" · "}
                        {formatExamTime(selected.examTime)}
                      </span>
                    </>
                  ) : (
                    MISSING
                  )}
                </DetailItem>
                <DetailItem label="Exam State">
                  <StateBadge state={selected.state} />
                </DetailItem>
              </dl>
            </div>
          )}

          <DialogFooter>
            {isScoreState && (
              <Link
                href="/admin/exam/scores"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                View Scores
              </Link>
            )}
            <DialogClose render={<Button variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
