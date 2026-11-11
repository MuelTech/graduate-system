"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead as SharedTableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ExamStateBadge } from "@/components/admin/exam/exam-state-badge";
import { AssignApplicantDialog } from "@/components/admin/exam/assign-applicant-dialog";
import {
  deriveExamState,
  EXAM_STATE_FILTERS,
  formatExamDate,
  formatExamTime,
  type ExamStateFilter,
  type ExamStateKey,
} from "@/lib/exam-record-state";
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
    state: deriveExamState(app.status, app.essayEvaluationCompleted, app.reconsidered),
  };
}

/* -------------------------------------------------------------- table parts */

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Table className="min-w-[820px] table-fixed">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[26%]" />
        <col className="w-[22%]" />
        <col className="w-[16%]" />
        <col className="w-[8%]" />
      </colgroup>
      {children}
    </Table>
  );
}

function TableHead() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-(--earist-surface-gray)">
        <SharedTableHead>Applicant</SharedTableHead>
        <SharedTableHead>Program</SharedTableHead>
        <SharedTableHead>Exam Schedule</SharedTableHead>
        <SharedTableHead>Exam State</SharedTableHead>
        <SharedTableHead className="text-right">Action</SharedTableHead>
      </TableRow>
    </TableHeader>
  );
}

function TableSkeleton() {
  return (
    <TableShell>
      <TableHead />
      <TableBody aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-28 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-8 w-8 rounded-md" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
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

/* ------------------------------------------------------------------- page */

export default function ExamRecordsPage() {
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState(ALL);
  const [examState, setExamState] = useState<ExamStateFilter>("ALL");
  const [page, setPage] = useState(1);

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
    EXAM_STATE_FILTERS.find((option) => option.value === examState)?.label ??
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrance Exam Records"
        description="Monitor entrance exam schedules, grading progress, and results."
        actions={<AssignApplicantDialog onAssigned={clearFilters} />}
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
                  {EXAM_STATE_FILTERS.map((option) => (
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
      <TableCard>
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
            <TableBody>
              {pageRows.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <p className="text-sm font-semibold break-words text-foreground">
                      {record.name || MISSING}
                    </p>
                    <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                      {record.pinnacleId || "No Pinnacle ID"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm break-words text-(--earist-body-text)">
                      {record.programName}
                    </p>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <ExamStateBadge state={record.state} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/exam/applications/${record.id}`}
                      aria-label={`View exam record for ${record.name || "applicant"}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "ml-auto",
                      )}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableShell>
        )}
      </TableCard>

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
    </div>
  );
}
