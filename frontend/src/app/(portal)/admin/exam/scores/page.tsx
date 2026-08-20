"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamAppResponse } from "@/types";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  X,
  Save,
  Eye,
  Loader2,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function AdminExamScoresPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"queue" | "review">("queue");
  const [selectedApplicant, setSelectedApplicant] = useState<string | null>(
    null,
  ); // Changed to string for UUID
  const [essayScore, setEssayScore] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [gradedByFilter, setGradedByFilter] = useState("all");

  // FETCH: Grading Queue
  const { data: queueData, isLoading: queueLoading, isError: queueError } = useQuery({
    queryKey: ["gradingQueue"],
    queryFn: () => apiClientRequest("/exam/scores/queue", { method: "GET" }),
  });

  // FETCH: Score Review
  const { data: reviewData, isLoading: reviewLoading, isError: reviewError } = useQuery({
    queryKey: ["scoreReview"],
    queryFn: () => apiClientRequest("/exam/scores/review", { method: "GET" }),
  });

  // Filtered scores based on active filters
  const filteredScores = useMemo(() => {
    return ((reviewData as ExamAppResponse[]) || []).filter((score) => {
      // Search filter (name + Pinnacle ID)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = `${score.student.user.firstName} ${score.student.user.lastName}`.toLowerCase();
        const username = score.student.user.username?.toLowerCase() || "";
        if (!name.includes(query) && !username.includes(query)) return false;
      }
      // Status filter
      if (statusFilter !== "all" && score.score?.status !== statusFilter) return false;
      // Program filter
      if (programFilter !== "all" && score.program.programName !== programFilter) return false;
      // Date range filter
      if (dateFrom && new Date(score.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999); // Include the entire "To" day
        if (new Date(score.createdAt) > to) return false;
      }
      // Graded By filter
      if (gradedByFilter !== "all") {
        const graderName = `${score.score?.gradedBy?.firstName} ${score.score?.gradedBy?.lastName}`;
        if (graderName !== gradedByFilter) return false;
      }
      return true;
    });
  }, [reviewData, searchQuery, statusFilter, programFilter, dateFrom, dateTo, gradedByFilter]);

  // Computed unique values for filter dropdowns
  const uniquePrograms = useMemo(() => {
    const programs = new Set(
      ((reviewData as ExamAppResponse[]) || []).map((s) => s.program.programName),
    );
    return Array.from(programs).sort();
  }, [reviewData]);

  const uniqueGraders = useMemo(() => {
    const graders = new Set(
      ((reviewData as ExamAppResponse[]) || [])
        .filter((s) => s.score?.gradedBy)
        .map(
          (s) => `${s.score!.gradedBy!.firstName} ${s.score!.gradedBy!.lastName}`,
        ),
    );
    return Array.from(graders).sort();
  }, [reviewData]);

  // MUTATION: Save Grade
  const gradeMutation = useMutation({
    mutationFn: (data: { applicationId: string; essayScore: number }) =>
      apiClientRequest(`/exam/scores/${data.applicationId}/grade`, {
        method: "POST",
        body: JSON.stringify({ essayScore: data.essayScore }),
      }),
    onSuccess: () => {
      toast.success("Score saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["gradingQueue"] });
      queryClient.invalidateQueries({ queryKey: ["scoreReview"] });
      setSelectedApplicant(null);
      setEssayScore("");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save score"),
  });

  // MUTATION: Send Email
  const emailMutation = useMutation({
    mutationFn: (applicationId: string) =>
      apiClientRequest(`/exam/scores/${applicationId}/send-email`, {
        method: "POST",
      }),
    onSuccess: (data: { message?: string }) =>
      toast.success(data.message || "Email dispatched!"),
    onError: (err: Error) => toast.error(err.message || "Failed to send email"),
  });

  // TRANSFORM DATA FOR UI
  const essayQueue = ((queueData as ExamAppResponse[]) || []).map((app) => ({
    id: app.id,
    name: `${app.student.user.firstName} ${app.student.user.lastName}`,
    email: app.student.user.email,
    pinnacleId: app.student.user.username || "N/A",
    program: app.program.programName,
    examDate: new Date(app.examDate || app.createdAt).toLocaleDateString(),
    mcqScore: Number(app.score?.multipleChoiceScore || 0),
    mcqTotal: app.program.examMcqTotal || 50,
    essayResponse: app.answers?.[0]?.essayAnswer || "No essay submitted.",
    essayTotal: app.program.examEssayTotal || 30,
  }));

  const scoreReview = filteredScores.map((app) => ({
    id: app.id,
    name: `${app.student.user.firstName} ${app.student.user.lastName}`,
    pinnacleId: app.student.user.username || "N/A",
    program: app.program.programName,
    mcqScore: Number(app.score?.multipleChoiceScore || 0),
    mcqTotal: app.program.examMcqTotal || 50,
    essayScore: Number(app.score?.essayScore || 0),
    essayTotal: app.program.examEssayTotal || 30,
    totalScore: Number(app.score?.totalScore || 0),
    totalPossible:
      (app.program.examMcqTotal || 50) + (app.program.examEssayTotal || 30),
    status: app.score?.status?.toLowerCase(),
    gradedBy: app.score?.gradedBy
      ? `${app.score.gradedBy.firstName} ${app.score.gradedBy.lastName}`
      : "System Admin",
    date: new Date(app.createdAt).toLocaleDateString(),
  }));

  // RESTORE PAGINATION VARIABLES
  const queueTotalPages = Math.ceil(essayQueue.length / pageSize);
  const queueStart = (page - 1) * pageSize;
  const paginatedQueue = essayQueue.slice(queueStart, queueStart + pageSize);

  const reviewTotalPages = Math.ceil(scoreReview.length / pageSize);
  const reviewStart = (page - 1) * pageSize;
  const paginatedReview = scoreReview.slice(
    reviewStart,
    reviewStart + pageSize,
  );

  const selectedApp = essayQueue.find(
    (a: { id: string }) => a.id === selectedApplicant,
  );
  // Calculate dynamic passing score as 75% of total points for the selected app
  const passingScore = selectedApp
    ? Math.floor((selectedApp.mcqTotal + selectedApp.essayTotal) * 0.75)
    : 0;

  const handleSaveScore = () => {
    if (!selectedApplicant || !essayScore) return;
    gradeMutation.mutate({
      applicationId: selectedApplicant,
      essayScore: Number(essayScore),
    });
  };

  if (queueLoading || reviewLoading) return <div className="p-8 text-center text-gray-500">Loading exam data...</div>;
  if (queueError || reviewError) return <div className="p-8 text-center text-red-500">Failed to load exam data. Please refresh.</div>;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Score Management
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Grade essays and manage examination scores
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setActiveTab("queue");
            setPage(1);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "queue"
              ? "bg-(--earist-primary) text-white"
              : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
          }`}
        >
          Essay Grading Queue ({essayQueue.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("review");
            setPage(1);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "review"
              ? "bg-(--earist-primary) text-white"
              : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
          }`}
        >
          Score Review ({scoreReview.length})
        </button>
      </div>

      {/* Essay Grading Queue */}
      {activeTab === "queue" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Queue List */}
          <div className="space-y-2">
            {paginatedQueue.map((applicant) => (
              <button
                key={applicant.id}
                onClick={() => setSelectedApplicant(applicant.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selectedApplicant === applicant.id
                    ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                    : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-(--earist-primary)">
                      {applicant.name}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {applicant.program} &middot; {applicant.pinnacleId}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">
                    <Clock className="mr-1 h-3 w-3" />
                    Awaiting
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-(--earist-body-text)">
                  <span>
                    MCQ:{" "}
                    <span className="font-medium text-(--earist-primary)">
                      {applicant.mcqScore}/{applicant.mcqTotal}
                    </span>
                  </span>
                  <span>Exam: {applicant.examDate}</span>
                </div>
              </button>
            ))}
            {queueTotalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className={
                        page <= 1 ? "pointer-events-none opacity-50" : ""
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: queueTotalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < queueTotalPages) setPage(page + 1);
                      }}
                      className={
                        page >= queueTotalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>

          {/* Essay Grading Form */}
          {selectedApp ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Essay Grading — {selectedApp.name}
                  </CardTitle>
                  <button
                    onClick={() => {
                      setSelectedApplicant(null);
                      setEssayScore("");
                    }}
                    className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* MCQ Score */}
                  <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                    <p className="text-xs text-(--earist-body-text)">
                      MCQ Score (auto-graded)
                    </p>
                    <p className="text-lg font-bold text-(--earist-primary)">
                      {selectedApp.mcqScore}
                      <span className="text-sm font-normal text-(--earist-body-text)">
                        {" "}
                        / {selectedApp.mcqTotal}
                      </span>
                    </p>
                  </div>

                  {/* Essay Response */}
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Essay Response
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                      <p className="text-sm text-(--earist-body-text)">
                        {selectedApp.essayResponse}
                      </p>
                    </div>
                  </div>

                  {/* Essay Score Input */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-(--earist-secondary)">
                        Essay Score
                      </label>
                      <span className="text-xs text-(--earist-body-text)">
                        max {selectedApp.essayTotal}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={selectedApp.essayTotal}
                      value={essayScore}
                      onChange={(e) => setEssayScore(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-center text-lg font-semibold text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                    />
                  </div>

                  {/* Total (auto-calculated) */}
                  {essayScore && (
                    <div className="rounded-lg bg-(--earist-surface-light-red) p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-(--earist-body-text)">
                          Total Score
                        </span>
                        <span className="text-lg font-bold text-(--earist-primary)">
                          {selectedApp.mcqScore + parseInt(essayScore || "0")}
                          <span className="text-sm font-normal text-(--earist-body-text)">
                            {" "}
                            / {selectedApp.mcqTotal + selectedApp.essayTotal}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-(--earist-body-text)">
                          Passing Score: {passingScore}
                        </span>
                        <Badge
                          className={
                            selectedApp.mcqScore +
                              parseInt(essayScore || "0") >=
                            passingScore
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {selectedApp.mcqScore + parseInt(essayScore || "0") >=
                          passingScore
                            ? "PASSED"
                            : "FAILED"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <Button
                    disabled={!essayScore || gradeMutation.isPending}
                    onClick={handleSaveScore}
                    className={`w-full ${
                      essayScore
                        ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                        : "cursor-not-allowed bg-gray-200 text-gray-400"
                    }`}
                  >
                    {gradeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {gradeMutation.isPending ? "Saving..." : "Save Score"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <FileText className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select an Applicant
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click an applicant from the queue to grade their essay.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Score Review Table */}
      {activeTab === "review" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Applicant
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      MCQ
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Essay
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Graded By
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReview.map((result) => {
                    const percentage = Math.round(
                      (result.totalScore / result.totalPossible) * 100,
                    );
                    return (
                      <tr
                        key={result.id}
                        className="border-b border-(--earist-border-gray) last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-(--earist-primary)">
                              {result.name}
                            </p>
                            <p className="text-xs text-(--earist-body-text)">
                              {result.program} &middot; {result.pinnacleId}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-(--earist-primary)">
                            {result.mcqScore}
                          </span>
                          <span className="text-xs text-(--earist-body-text)">
                            /{result.mcqTotal}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-(--earist-primary)">
                            {result.essayScore}
                          </span>
                          <span className="text-xs text-(--earist-body-text)">
                            /{result.essayTotal}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div>
                            <span className="font-bold text-(--earist-primary)">
                              {result.totalScore}
                            </span>
                            <span className="text-xs text-(--earist-body-text)">
                              /{result.totalPossible}
                            </span>
                            <p className="text-[11px] text-(--earist-body-text)">
                              ({percentage}%)
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {result.status === "passed" ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Passed
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                          {result.gradedBy}
                        </td>
                        <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                          {result.date}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray) disabled:opacity-50"
                              title="Send Result Email"
                              onClick={() => emailMutation.mutate(result.id)}
                              disabled={emailMutation.isPending}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reviewTotalPages > 1 && (
              <div className="border-t border-(--earist-border-gray) p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                        className={
                          page <= 1 ? "pointer-events-none opacity-50" : ""
                        }
                      />
                    </PaginationItem>
                    {Array.from(
                      { length: reviewTotalPages },
                      (_, i) => i + 1,
                    ).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < reviewTotalPages) setPage(page + 1);
                        }}
                        className={
                          page >= reviewTotalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
