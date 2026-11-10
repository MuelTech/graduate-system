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
  TableCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { formatExamDate, formatExamTime } from "@/lib/exam-record-state";
import type { ApiApplication, Program } from "@/types";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;

type EvaluationFilter = "ALL" | "PENDING" | "EVALUATED";

interface EssaySubmissionRow {
  id: string;
  name: string;
  email: string;
  pinnacleId: string;
  programId: string | null;
  programName: string;
  examDate: string | null;
  examTime: string | null;
  status: string;
  isEvaluated: boolean;
}

function toSubmissionRow(app: ApiApplication): EssaySubmissionRow | null {
  // Only TAKEN, PASSED, or FAILED applications have submitted exam responses
  if (
    app.status !== "TAKEN" &&
    app.status !== "PASSED" &&
    app.status !== "FAILED"
  ) {
    return null;
  }

  const isEvaluated =
    app.essayEvaluationCompleted === true ||
    app.status === "PASSED" ||
    app.status === "FAILED";

  return {
    id: app.id,
    name: `${app.student.user.firstName} ${app.student.user.lastName}`.trim(),
    email: app.student.user.email ?? "",
    pinnacleId: app.student.pinnacleApplicantId || "No Pinnacle ID",
    programId: app.program?.id ?? null,
    programName: app.program?.programName ?? "—",
    examDate: app.slot?.examDate ?? null,
    examTime: app.slot?.examTime ?? null,
    status: app.status,
    isEvaluated,
  };
}

export default function FacultyEssayEvaluationsPage() {
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState("ALL");
  const [evalFilter, setEvalFilter] = useState<EvaluationFilter>("ALL");
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

  const allSubmissions: EssaySubmissionRow[] = (recordsQuery.data ?? [])
    .map(toSubmissionRow)
    .filter((row): row is EssaySubmissionRow => row !== null);

  const query = search.trim().toLowerCase();
  const filtered = allSubmissions.filter((row) => {
    const matchesSearch =
      query === "" ||
      row.name.toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.pinnacleId.toLowerCase().includes(query) ||
      row.programName.toLowerCase().includes(query);

    const matchesProgram = programId === "ALL" || row.programId === programId;
    const matchesFilter =
      evalFilter === "ALL" ||
      (evalFilter === "PENDING" && !row.isEvaluated) ||
      (evalFilter === "EVALUATED" && row.isEvaluated);

    return matchesSearch && matchesProgram && matchesFilter;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const isFiltered =
    search.trim() !== "" || programId !== "ALL" || evalFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setProgramId("ALL");
    setEvalFilter("ALL");
    setPage(1);
  };

  const programLabel =
    programId === "ALL"
      ? "All Programs"
      : (programs.find((p) => p.id === programId)?.programName ??
        "All Programs");

  const EVAL_FILTER_OPTIONS: { value: EvaluationFilter; label: string }[] = [
    { value: "ALL", label: "All Statuses" },
    { value: "PENDING", label: "Pending Evaluation" },
    { value: "EVALUATED", label: "Evaluated" },
  ];
  const evalFilterLabel =
    EVAL_FILTER_OPTIONS.find((o) => o.value === evalFilter)?.label ??
    "All Statuses";

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
        title="Essay Evaluations"
        description="Evaluate applicant entrance examination essays and compute official exam results."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void recordsQuery.refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label
                htmlFor="essay-search"
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
                  id="essay-search"
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by applicant name, email, or Pinnacle ID..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-full sm:w-72">
              <label
                htmlFor="essay-program"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Program
              </label>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value ?? "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger id="essay-program" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={programLabel}
                  >
                    {programLabel}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[min(92vw,24rem)]">
                  <SelectItem
                    value="ALL"
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

            <div className="w-full sm:w-48">
              <label
                htmlFor="essay-status"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Evaluation Status
              </label>
              <Select
                value={evalFilter}
                onValueChange={(value) => {
                  setEvalFilter((value as EvaluationFilter) ?? "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger id="essay-status" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={evalFilterLabel}
                  >
                    {evalFilterLabel}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {EVAL_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isFiltered && (
              <div className="flex items-center gap-2 sm:ml-auto sm:pb-0.5">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <TableCard>
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <AlertCircle className="h-8 w-8 text-(--earist-secondary)" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-(--earist-primary)">
                Unable to load essay evaluations
              </p>
              <p className="text-sm text-(--earist-body-text)">
                Something went wrong while loading the submissions. Please try
                again.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void recordsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <ClipboardCheck className="h-10 w-10 text-(--earist-body-text)/40" />
            <p className="text-sm font-semibold text-(--earist-primary)">
              {isFiltered
                ? "No essay submissions match the current filters"
                : "No entrance exam essay submissions yet"}
            </p>
            <p className="max-w-sm text-xs text-(--earist-body-text)">
              {isFiltered
                ? "Try clearing your search or status filter."
                : "Completed applicant entrance exams will appear here for essay evaluation."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-(--earist-surface-gray)">
                <TableHead>Applicant</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Exam Schedule</TableHead>
                <TableHead className="text-center">Evaluation Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="text-sm font-semibold text-foreground">
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs text-(--earist-body-text)">
                      {row.pinnacleId}
                    </p>
                    <p className="mt-0.5 text-xs text-(--earist-body-text)">
                      {row.email}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-(--earist-body-text)">
                    {row.programName}
                  </TableCell>
                  <TableCell className="text-sm text-(--earist-body-text)">
                    {row.examDate ? (
                      <div>
                        <p>{formatExamDate(row.examDate)}</p>
                        <p className="mt-0.5 text-xs text-(--earist-body-text)">
                          {formatExamTime(row.examTime)}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        row.isEvaluated
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {row.isEvaluated ? "Evaluated" : "Pending Evaluation"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/faculty/essay-evaluations/${row.id}`}
                      className={cn(
                        buttonVariants({
                          variant: row.isEvaluated ? "outline" : "default",
                          size: "sm",
                        }),
                        !row.isEvaluated &&
                          "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90",
                      )}
                    >
                      {row.isEvaluated ? "View Evaluation" : "Evaluate Essay"}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, total)} of {total} submission
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
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <Button
                      variant={
                        currentPage === pageNumber ? "outline" : "ghost"
                      }
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
                      setPage((p) => Math.min(totalPages, p + 1))
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
