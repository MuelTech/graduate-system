"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  X,
  Save,
  Eye,
} from "lucide-react";

export default function AdminExamScoresPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "review">("queue");
  const [selectedApplicant, setSelectedApplicant] = useState<number | null>(null);
  const [essayScore, setEssayScore] = useState("");

  const essayQueue = [
    {
      id: 1,
      name: "Juan Dela Cruz",
      email: "juan.delacruz@gmail.com",
      pinnacleId: "PIN-2026-001",
      program: "MSCS",
      examDate: "June 15, 2026",
      mcqScore: 38,
      mcqTotal: 50,
      essayResponse:
        "Research ethics is fundamental to graduate studies as it ensures the integrity and credibility of academic work. Maintaining academic integrity contributes to the advancement of knowledge by establishing trust among researchers and the public. For example, proper citation practices prevent plagiarism and give credit to original authors, while honest data reporting ensures that findings can be replicated and verified by other researchers. In the field of Computer Science, ethical considerations in AI development, such as bias prevention and transparency, are crucial for building responsible systems that benefit society...",
    },
    {
      id: 2,
      name: "Ana Garcia",
      email: "ana.garcia@gmail.com",
      pinnacleId: "PIN-2026-004",
      program: "MAED",
      examDate: "June 15, 2026",
      mcqScore: 42,
      mcqTotal: 50,
      essayResponse:
        "Academic integrity forms the cornerstone of graduate education. In educational research, maintaining ethical standards ensures that findings are valid and reliable. For instance, when conducting surveys or experiments, researchers must obtain informed consent from participants and protect their privacy. This not only upholds moral standards but also enhances the credibility of the research. Furthermore, institutions benefit from a culture of integrity as it attracts quality researchers and fosters an environment of intellectual growth...",
    },
  ];

  const scoreReview = [
    {
      id: 101,
      name: "Maria Santos",
      pinnacleId: "PIN-2026-002",
      program: "MSCS",
      mcqScore: 38,
      mcqTotal: 50,
      essayScore: 28,
      essayTotal: 30,
      totalScore: 66,
      totalPossible: 80,
      status: "passed" as "passed" | "failed",
      gradedBy: "Dr. Roberto Reyes",
      date: "June 16, 2026",
    },
    {
      id: 102,
      name: "Carlos Luna",
      pinnacleId: "PIN-2026-005",
      program: "PhD Education",
      mcqScore: 24,
      mcqTotal: 50,
      essayScore: 18,
      essayTotal: 30,
      totalScore: 42,
      totalPossible: 80,
      status: "failed" as "passed" | "failed",
      gradedBy: "Dr. Roberto Reyes",
      date: "June 16, 2026",
    },
    {
      id: 103,
      name: "Roberto Lim",
      pinnacleId: "PIN-2026-007",
      program: "DIT",
      mcqScore: 40,
      mcqTotal: 50,
      essayScore: 26,
      essayTotal: 30,
      totalScore: 66,
      totalPossible: 80,
      status: "passed" as "passed" | "failed",
      gradedBy: "Dr. Ana Garcia",
      date: "June 15, 2026",
    },
  ];

  const passingScore = 48;

  const selectedApp = essayQueue.find((a) => a.id === selectedApplicant);

  const handleSaveScore = () => {
    setSelectedApplicant(null);
    setEssayScore("");
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Score Management
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Grade essays and manage examination scores
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("queue")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "queue"
              ? "bg-[var(--earist-primary)] text-white"
              : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
          }`}
        >
          Essay Grading Queue ({essayQueue.length})
        </button>
        <button
          onClick={() => setActiveTab("review")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "review"
              ? "bg-[var(--earist-primary)] text-white"
              : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
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
            {essayQueue.map((applicant) => (
              <button
                key={applicant.id}
                onClick={() => setSelectedApplicant(applicant.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selectedApplicant === applicant.id
                    ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]"
                    : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--earist-primary)]">
                      {applicant.name}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {applicant.program} &middot; {applicant.pinnacleId}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">
                    <Clock className="mr-1 h-3 w-3" />
                    Awaiting
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-[var(--earist-body-text)]">
                  <span>
                    MCQ:{" "}
                    <span className="font-medium text-[var(--earist-primary)]">
                      {applicant.mcqScore}/{applicant.mcqTotal}
                    </span>
                  </span>
                  <span>Exam: {applicant.examDate}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Essay Grading Form */}
          {selectedApp ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                    Essay Grading — {selectedApp.name}
                  </CardTitle>
                  <button
                    onClick={() => {
                      setSelectedApplicant(null);
                      setEssayScore("");
                    }}
                    className="rounded p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* MCQ Score */}
                  <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                    <p className="text-xs text-[var(--earist-body-text)]">
                      MCQ Score (auto-graded)
                    </p>
                    <p className="text-lg font-bold text-[var(--earist-primary)]">
                      {selectedApp.mcqScore}
                      <span className="text-sm font-normal text-[var(--earist-body-text)]">
                        {" "}
                        / {selectedApp.mcqTotal}
                      </span>
                    </p>
                  </div>

                  {/* Essay Response */}
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[var(--earist-secondary)]">
                      Essay Response
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)] p-3">
                      <p className="text-sm text-[var(--earist-body-text)]">
                        {selectedApp.essayResponse}
                      </p>
                    </div>
                  </div>

                  {/* Essay Score Input */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-[var(--earist-secondary)]">
                        Essay Score
                      </label>
                      <span className="text-xs text-[var(--earist-body-text)]">
                        max 30
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={essayScore}
                      onChange={(e) => setEssayScore(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] p-3 text-lg font-semibold text-center text-[var(--earist-primary)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
                    />
                  </div>

                  {/* Total (auto-calculated) */}
                  {essayScore && (
                    <div className="rounded-lg bg-[var(--earist-surface-light-red)] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--earist-body-text)]">
                          Total Score
                        </span>
                        <span className="text-lg font-bold text-[var(--earist-primary)]">
                          {selectedApp.mcqScore + parseInt(essayScore || "0")}
                          <span className="text-sm font-normal text-[var(--earist-body-text)]">
                            {" "}
                            / {selectedApp.mcqTotal + 30}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-[var(--earist-body-text)]">
                          Passing Score: {passingScore}
                        </span>
                        <Badge
                          className={
                            selectedApp.mcqScore + parseInt(essayScore || "0") >=
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
                    disabled={!essayScore}
                    onClick={handleSaveScore}
                    className={`w-full ${
                      essayScore
                        ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                        : "cursor-not-allowed bg-gray-200 text-gray-400"
                    }`}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Score
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]">
                    <FileText className="h-8 w-8 text-[var(--earist-body-text)]/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
                    Select an Applicant
                  </h3>
                  <p className="text-sm text-[var(--earist-body-text)]">
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
                  <tr className="border-b border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                      Applicant
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                      MCQ
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                      Essay
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                      Graded By
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--earist-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scoreReview.map((result) => {
                    const percentage = Math.round(
                      (result.totalScore / result.totalPossible) * 100
                    );
                    return (
                      <tr
                        key={result.id}
                        className="border-b border-[var(--earist-border-gray)] last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[var(--earist-primary)]">
                              {result.name}
                            </p>
                            <p className="text-xs text-[var(--earist-body-text)]">
                              {result.program} &middot; {result.pinnacleId}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-[var(--earist-primary)]">
                            {result.mcqScore}
                          </span>
                          <span className="text-xs text-[var(--earist-body-text)]">
                            /{result.mcqTotal}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-[var(--earist-primary)]">
                            {result.essayScore}
                          </span>
                          <span className="text-xs text-[var(--earist-body-text)]">
                            /{result.essayTotal}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div>
                            <span className="font-bold text-[var(--earist-primary)]">
                              {result.totalScore}
                            </span>
                            <span className="text-xs text-[var(--earist-body-text)]">
                              /{result.totalPossible}
                            </span>
                            <p className="text-[11px] text-[var(--earist-body-text)]">
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
                        <td className="px-4 py-3 text-xs text-[var(--earist-body-text)]">
                          {result.gradedBy}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--earist-body-text)]">
                          {result.date}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                              title="Send Result Email"
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
