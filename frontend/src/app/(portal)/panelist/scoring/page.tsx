"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck2, CheckCircle2, X, Send, ArrowLeft } from "lucide-react";

export default function PanelistScoringPage() {
  const submissionState = "form" as "form" | "submitted";

  const defenses = [
    {
      id: 1,
      stage: "Final Defense",
      researcher: "Maria Santos",
      program: "MSCS",
      date: "June 10, 2026",
    },
    {
      id: 2,
      stage: "Proposal Defense",
      researcher: "Juan Dela Cruz",
      program: "MSCS",
      date: "June 12, 2026",
    },
    {
      id: 3,
      stage: "Title Defense",
      researcher: "Ana Garcia",
      program: "MIT",
      date: "June 15, 2026",
    },
  ];

  const [selectedDefenseId, setSelectedDefenseId] = useState<number | null>(
    null,
  );
  const selectedDefense = defenses.find((d) => d.id === selectedDefenseId);

  const groupA = [
    { name: "Timeliness & Relevance", max: 10 },
    { name: "Organization", max: 10 },
    { name: "Depth & Comprehensiveness", max: 15 },
    { name: "Relevance of Conclusions", max: 10 },
    { name: "Evidence of Original Thinking", max: 15 },
  ];

  const groupB = [
    { name: "Presentation", max: 10 },
    { name: "Mastery of Subject", max: 10 },
    { name: "Communication Skill", max: 10 },
    { name: "Attitude", max: 10 },
  ];

  const allCriteria = [...groupA, ...groupB];
  const totalPossible = allCriteria.reduce((sum, c) => sum + c.max, 0);

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(allCriteria.map((c) => [c.name, 0])),
  );
  const [comments, setComments] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

  const allScored = allCriteria.every((c) => scores[c.name] > 0);

  const handleScoreChange = (name: string, value: string, max: number) => {
    const num = parseInt(value) || 0;
    setScores((prev) => ({
      ...prev,
      [name]: Math.min(Math.max(0, num), max),
    }));
  };

  if (submissionState === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                Scores Submitted
              </h3>
              <p className="mb-4 text-sm text-(--earist-body-text)">
                Your evaluation has been recorded successfully.
              </p>
              <Badge className="mb-4 bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Submitted
              </Badge>
              <Link
                href="/panelist/defenses"
                className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) hover:text-(--earist-primary)"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Defenses
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Defense Selector */}
      {!selectedDefenseId && (
        <div className="p-4">
          <h3
            className="mb-3 text-lg font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Select Defense to Score
          </h3>
          <div className="space-y-2">
            {defenses.map((defense) => (
              <button
                key={defense.id}
                onClick={() => setSelectedDefenseId(defense.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-(--earist-border-gray) p-4 text-left transition-colors hover:bg-(--earist-surface-gray)"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <FileCheck2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {defense.stage}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {defense.researcher} &middot; {defense.program}
                  </p>
                </div>
                <Badge className="bg-blue-100 text-blue-700">
                  {defense.date}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Form — shown after selecting a defense */}
      {selectedDefenseId && selectedDefense && (
        <>
          {/* Fixed Header — Researcher Info */}
          <div className="sticky top-16 z-20 border-b border-(--earist-border-gray) bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedDefense.stage}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedDefense.researcher} &middot;{" "}
                  {selectedDefense.program}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700">
                  {selectedDefense.date}
                </Badge>
                <button
                  onClick={() => {
                    setSelectedDefenseId(null);
                    setScores(
                      Object.fromEntries(allCriteria.map((c) => [c.name, 0])),
                    );
                    setComments("");
                  }}
                  className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Running Total */}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-(--earist-surface-light-red) p-2">
              <span className="text-xs font-medium text-(--earist-body-text)">
                Your Score
              </span>
              <span className="text-lg font-bold text-(--earist-primary)">
                {totalScore}
                <span className="text-sm font-normal text-(--earist-body-text)">
                  {" "}
                  / {totalPossible}
                </span>
              </span>
            </div>
          </div>

          {/* Scoring Form */}
          <div className="p-4">
            {/* Group A */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Group A: Research Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupA.map((criterion) => (
                    <div key={criterion.name}>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm text-(--earist-primary)">
                          {criterion.name}
                        </label>
                        <span className="text-xs text-(--earist-body-text)">
                          max {criterion.max}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={criterion.max}
                        value={scores[criterion.name] || ""}
                        onChange={(e) =>
                          handleScoreChange(
                            criterion.name,
                            e.target.value,
                            criterion.max,
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-center text-lg font-semibold text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Group B */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Group B: Presentation & Defense
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupB.map((criterion) => (
                    <div key={criterion.name}>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm text-(--earist-primary)">
                          {criterion.name}
                        </label>
                        <span className="text-xs text-(--earist-body-text)">
                          max {criterion.max}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={criterion.max}
                        value={scores[criterion.name] || ""}
                        onChange={(e) =>
                          handleScoreChange(
                            criterion.name,
                            e.target.value,
                            criterion.max,
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-center text-lg font-semibold text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comments */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Recommendations or Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Optional comments or recommendations..."
                  className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Fixed Bottom Submit Button */}
      {selectedDefenseId && (
        <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-(--earist-border-gray) bg-white p-4 lg:left-[260px]">
          <Button
            disabled={!allScored}
            onClick={() => setShowConfirm(true)}
            className={`w-full py-6 text-base font-semibold ${
              allScored
                ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            <Send className="mr-2 h-5 w-5" />
            Submit Evaluation
          </Button>
          {!allScored && (
            <p className="mt-1 text-center text-xs text-(--earist-body-text)">
              Score all criteria to submit
            </p>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && selectedDefense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Confirm Submission
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-2">
              <p className="text-sm text-(--earist-body-text)">
                Are you sure you want to submit your evaluation?
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  Total Score: {totalScore} / {totalPossible}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedDefense.researcher} — {selectedDefense.stage}
                </p>
              </div>
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                Confirm Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
