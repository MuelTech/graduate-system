"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface DefenseData {
  defenseType: string;
  defenseDate: string;
  thesis: {
    student: {
      programId: string;
      user: {
        firstName: string;
        lastName: string;
      };
    };
    thesisDocuments?: Array<{ id: string; docType: string; filePath: string }>;
  };
}

export default function PanelistScoringPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const scheduleId = params.id as string;
  const panelId = searchParams.get("panelId");

  const [defenseData, setDefenseData] = useState<DefenseData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"form" | "submitted">(
    "form",
  );

  const groupA = [
    { id: "timelinessRelevance", name: "Timeliness & Relevance", max: 10 },
    { id: "organization", name: "Organization", max: 10 },
    {
      id: "depthComprehensiveness",
      name: "Depth & Comprehensiveness",
      max: 15,
    },
    { id: "relevanceConclusions", name: "Relevance of Conclusions", max: 10 },
    {
      id: "evidenceOriginalThinking",
      name: "Evidence of Original Thinking",
      max: 15,
    },
  ];

  const groupB = [
    { id: "presentation", name: "Presentation", max: 10 },
    { id: "masterySubject", name: "Mastery of Subject", max: 10 },
    { id: "communicationSkill", name: "Communication Skill", max: 10 },
    { id: "attitude", name: "Attitude", max: 10 },
  ];

  const allCriteria = [...groupA, ...groupB];
  const totalPossible = allCriteria.reduce((sum, c) => sum + c.max, 0);

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(allCriteria.map((c) => [c.id, 0])),
  );

  useEffect(() => {
    // Fetch the specific schedule details
    apiClientRequest("/thesis/defense/panelist/assignments").then(
      (data: unknown) => {
        if (Array.isArray(data)) {
          const assignment = data.find(
            (a: { schedule: { id: string } }) => a.schedule.id === scheduleId,
          );
          if (assignment) setDefenseData(assignment.schedule);
        }
      },
    );
  }, [scheduleId]);

  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const allScored = allCriteria.every((c) => scores[c.id] > 0);

  const handleScoreChange = (id: string, value: string, max: number) => {
    const num = parseInt(value) || 0;
    setScores((prev) => ({
      ...prev,
      [id]: Math.min(Math.max(0, num), max),
    }));
  };

  const handleSubmit = async () => {
    if (!panelId) {
      alert("Missing Panel ID.");
      return;
    }

    try {
      setIsSubmitting(true);

      const groupATotal = groupA.reduce((sum, c) => sum + scores[c.id], 0);
      const groupBTotal = groupB.reduce((sum, c) => sum + scores[c.id], 0);

      await apiClientRequest(`/thesis/defense/${scheduleId}/score`, {
        method: "POST",
        body: JSON.stringify({
          panelId,
          scores: {
            ...scores,
            groupAAverage: groupATotal, // Saving the raw sum out of 60
            groupBAverage: groupBTotal, // Saving the raw sum out of 40
            overallAverage: totalScore, // Saving the grand total out of 100
            rating: totalScore >= 75 ? "PASSED" : "FAILED", // Using 75 as passing mark for now
          },
        }),
      });

      setSubmissionState("submitted");
    } catch (error: unknown) {
      alert("Failed to submit scores: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submissionState === "submitted") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
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
                href="/panelist/scoring"
                className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) hover:text-(--earist-primary)"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!defenseData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500 animate-pulse">Loading Defense Data...</p>
      </div>
    );
  }

  const student = defenseData.thesis?.student?.user;

  return (
    <div className="pb-24">
      {/* Fixed Header — Researcher Info */}
      <div className="sticky top-16 z-20 border-b border-(--earist-border-gray) bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/panelist/scoring"
                className="text-gray-400 hover:text-(--earist-primary)"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <p className="text-sm font-semibold text-(--earist-primary)">
                {defenseData.defenseType.replace("_", " ").toUpperCase()}
              </p>
            </div>
            <p className="text-xs text-(--earist-body-text) ml-7">
              {student?.firstName} {student?.lastName} &middot;{" "}
              {defenseData.thesis?.student?.programId || "Program"}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3 ml-7">
              {defenseData.thesis?.thesisDocuments &&
              defenseData.thesis.thesisDocuments.length > 0 ? (
                defenseData.thesis.thesisDocuments.map((doc) => (
                  <a
                    key={doc.id}
                    href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000"}/${doc.filePath.replace(/\\/g, "/")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors"
                  >
                    View {doc.docType.replace("_", " ")}
                  </a>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">
                  No documents uploaded.
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-700 hidden sm:inline-flex">
              {new Date(defenseData.defenseDate).toLocaleDateString()}
            </Badge>
          </div>
        </div>
        {/* Running Total */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-(--earist-surface-light-red) p-3 shadow-inner">
          <span className="text-sm font-bold text-(--earist-body-text)">
            Your Score
          </span>
          <span className="text-2xl font-black text-(--earist-primary)">
            {totalScore}
            <span className="text-sm font-normal text-(--earist-body-text)">
              {" "}
              / {totalPossible}
            </span>
          </span>
        </div>
      </div>

      {/* Scoring Form */}
      <div className="p-4 max-w-3xl mx-auto mt-4">
        {/* Group A */}
        <Card className="mb-6 shadow-sm border-t-4 border-t-(--earist-primary)">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-(--earist-secondary)">
              Group A: Research Content (60 Points)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupA.map((criterion) => (
                <div key={criterion.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-semibold text-(--earist-primary)">
                      {criterion.name}
                    </label>
                    <span className="text-xs font-bold text-(--earist-body-text)">
                      max {criterion.max}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={criterion.max}
                    value={scores[criterion.id] || ""}
                    onChange={(e) =>
                      handleScoreChange(
                        criterion.id,
                        e.target.value,
                        criterion.max,
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-(--earist-border-gray) bg-blue-50/30 p-3 text-center text-xl font-bold text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Group B */}
        <Card className="mb-6 shadow-sm border-t-4 border-t-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-(--earist-secondary)">
              Group B: Presentation & Defense (40 Points)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupB.map((criterion) => (
                <div key={criterion.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-semibold text-(--earist-primary)">
                      {criterion.name}
                    </label>
                    <span className="text-xs font-bold text-(--earist-body-text)">
                      max {criterion.max}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={criterion.max}
                    value={scores[criterion.id] || ""}
                    onChange={(e) =>
                      handleScoreChange(
                        criterion.id,
                        e.target.value,
                        criterion.max,
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-(--earist-border-gray) bg-green-50/30 p-3 text-center text-xl font-bold text-(--earist-primary) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="mt-8">
          <Button
            onClick={handleSubmit}
            disabled={!allScored || isSubmitting}
            className={`w-full py-6 text-base font-bold shadow-lg ${
              allScored
                ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Submit Final Score
              </>
            )}
          </Button>
          {!allScored && (
            <p className="mt-2 text-center text-xs font-medium text-(--earist-body-text)">
              Please score all criteria before submitting.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
