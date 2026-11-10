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
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { formatExamDate, formatExamTime } from "@/lib/exam-record-state";
import type { ApiApplication, Program } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Filter,
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

  const totalSubmissions = allSubmissions.length;
  const pendingCount = allSubmissions.filter((r) => !r.isEvaluated).length;
  const evaluatedCount = allSubmissions.filter((r) => r.isEvaluated).length;

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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-(--earist-body-text)">
                Total Submissions
              </p>
              <p className="text-2xl font-bold text-(--earist-primary)">
                {totalSubmissions}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Completed entrance exam sessions
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--earist-surface-gray) text-(--earist-secondary)">
              <FileText className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-(--earist-body-text)">
                Pending Evaluation
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {pendingCount}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Awaiting essay grading
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-(--earist-body-text)">
                Evaluated
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {evaluatedCount}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Essay graded and result computed
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by applicant name, email, Pinnacle ID, or program..."
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="ALL">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.programName}
                  </option>
                ))}
              </select>

              <select
                value={evalFilter}
                onChange={(e) => {
                  setEvalFilter(e.target.value as EvaluationFilter);
                  setPage(1);
                }}
                className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Evaluation</option>
                <option value="EVALUATED">Evaluated</option>
              </select>

              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
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
              <TableRow className="hover:bg-transparent">
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
                    <p className="font-semibold text-(--earist-primary)">
                      {row.name}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {row.pinnacleId} · {row.email}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-(--earist-body-text)">
                    {row.programName}
                  </TableCell>
                  <TableCell className="text-xs text-(--earist-body-text)">
                    {row.examDate ? (
                      <div>
                        <p>{formatExamDate(row.examDate)}</p>
                        <p className="text-[11px] text-gray-500">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-(--earist-border-gray) px-4 py-3">
            <p className="text-xs text-(--earist-body-text)">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, total)} of {total} submissions
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </TableCard>
    </div>
  );
}
