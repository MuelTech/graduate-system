"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import type { AdminStudentListItem, Program } from "@/types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;
const ALL = "ALL";

/* ----------------------------------------------------------- presentation */

const STATUS_LABEL: Record<string, string> = {
  ENROLLED: "Enrolled",
  GRADUATED: "Graduated",
  DISMISSED: "Dismissed",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  ENROLLED: "text-(--earist-success)",
  GRADUATED: "text-(--earist-secondary)",
  DISMISSED: "text-destructive",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Students" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "DISMISSED", label: "Dismissed" },
];

const COMP_EXAM_LABEL: Record<string, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  PENDING: "Pending",
};

const COMP_EXAM_CLASS: Record<string, string> = {
  PASSED: "text-(--earist-success)",
  FAILED: "text-destructive",
  PENDING: "text-(--earist-warning)",
};

const THESIS_STAGE_LABEL: Record<string, string> = {
  TITLE: "Title Defense",
  PROPOSAL: "Proposal Defense",
  FINAL: "Final Defense",
};

const THESIS_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
  PASSED: "Passed",
  FAILED: "Failed",
  REVISION: "Revision required",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function compExamLabel(status: string): string {
  if (!status || status === "NOT_RECORDED") return "Not recorded";
  return COMP_EXAM_LABEL[status] ?? status;
}

/* --------------------------------------------------------------- utilities */

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/* ------------------------------------------------------------- components */

function StudentStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_BADGE_CLASS[status])}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function CompExamCell({ status }: { status: string }) {
  const label = compExamLabel(status);
  const tone =
    !status || status === "NOT_RECORDED"
      ? "text-(--earist-body-text)/70"
      : (COMP_EXAM_CLASS[status] ?? "text-(--earist-body-text)");
  return <span className={cn("text-sm", tone)}>{label}</span>;
}

function ThesisProgressCell({
  stage,
  status,
}: {
  stage: string;
  status: string;
}) {
  if (!stage || stage === "NONE") {
    return (
      <span className="text-sm text-(--earist-body-text)/70">
        No thesis record
      </span>
    );
  }
  const stageLabel = THESIS_STAGE_LABEL[stage] ?? stage;
  const statusLabelText =
    status && status !== "NONE"
      ? (THESIS_STATUS_LABEL[status] ?? status)
      : null;
  return (
    <div className="min-w-0">
      <p className="text-sm break-words text-foreground">{stageLabel}</p>
      {statusLabelText ? (
        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
          {statusLabelText}
        </p>
      ) : null}
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[22%]" />
          <col className="w-[15%]" />
          <col className="w-[17%]" />
          <col className="w-[14%]" />
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
          Student
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Program
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Comprehensive Exam
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Thesis Progress
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Student Status
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
              <Skeleton className="mt-2 h-3 w-44" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-32" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-20" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-16" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-20 rounded-full" />
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
        <Users
          className="h-8 w-8 text-(--earist-body-text)/40"
          aria-hidden="true"
        />
      )}
      <p className="text-sm font-medium text-(--earist-primary)">
        {filtered
          ? "No students match the current filters."
          : "No students in the registry."}
      </p>
      <p className="max-w-sm text-sm text-(--earist-body-text)">
        {filtered
          ? "Try a different search term, program, or student status."
          : "Enrolled, graduated, and dismissed students will appear here."}
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
          Unable to load students
        </p>
        <p className="text-sm text-(--earist-body-text)">
          The student registry for the current view could not be loaded. Please
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

export default function AdminStudentsPage() {
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const programsQuery = useQuery({
    queryKey: ["programs"],
    queryFn: async () => apiClientRequest("/programs"),
  });
  const graduatePrograms: Program[] = programsQuery.data?.graduatePrograms ?? [];

  const studentsQuery = useQuery({
    queryKey: ["adminStudents", page, trimmedSearch, programId, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (programId !== ALL) params.set("program", programId);
      if (status !== "ALL") params.set("status", status);
      return apiClientRequest(`/admin/students?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const isLoading = studentsQuery.isLoading;
  const isFetching = studentsQuery.isFetching;
  const isError = studentsQuery.isError;
  const isPlaceholderData = studentsQuery.isPlaceholderData;
  const isPaused = studentsQuery.fetchStatus === "paused";
  const hasData = studentsQuery.data != null;

  // Query-key-scoped data only: a different filter/search/page is a different
  // query key. While it is in flight the previous key's rows may remain for
  // layout stability, but once it fails we must not present unrelated rows as
  // the result of the newly selected filter.
  const filterRequestFailed = (isError || isPaused) && isPlaceholderData;
  const loadFailedWithoutData = isError && !hasData;
  const sameQueryRefetchFailed =
    (isError || isPaused) && hasData && !isPlaceholderData;

  const students: AdminStudentListItem[] = studentsQuery.data?.students ?? [];
  const total: number = studentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered =
    trimmedSearch !== "" || programId !== ALL || status !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setProgramId(ALL);
    setStatus("ALL");
    setPage(1);
  };

  const programLabel =
    programId === ALL
      ? "All Programs"
      : (graduatePrograms.find((program) => program.id === programId)
          ?.programName ?? "All Programs");
  const statusLabelText =
    STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "All Students";

  const pageNumbers = (() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2)
      return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
    return [page - 2, page - 1, page, page + 1, page + 2];
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="View graduate students and monitor their academic progress."
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label
                htmlFor="student-search"
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
                  id="student-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, student number, or email..."
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
                  setProgramId(value ?? ALL);
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
                    value={ALL}
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
                htmlFor="filter-status"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Student Status
              </label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value ?? "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-status" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={statusLabelText}
                  >
                    {statusLabelText}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
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

      {/* Same-query background refetch failure: keep usable rows + feedback */}
      {sameQueryRefetchFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh the list. Showing the most recent results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => studentsQuery.refetch()}
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
              onRetry={() => studentsQuery.refetch()}
              retrying={isFetching}
            />
          ) : students.length === 0 ? (
            <EmptyState filtered={isFiltered} onClear={clearFilters} />
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-semibold break-words text-foreground">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                        {student.studentNumber} · {student.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {student.program?.programName ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <CompExamCell status={student.compExamStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <ThesisProgressCell
                        stage={student.thesisStage}
                        status={student.thesisStatus}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StudentStatusBadge status={student.admissionStatus} />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Link
                        href={`/admin/users/students/${student.id}`}
                        aria-label={`View student ${student.firstName} ${student.lastName}`}
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
      {!isLoading && students.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, total)} of {total} student
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
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
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
