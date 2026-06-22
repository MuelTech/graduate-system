// frontend/src/app/(portal)/student/thesis/page.tsx
import Link from "next/link";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
  ExternalLink,
  Download,
  AlertCircle,
  Users,
} from "lucide-react";

async function getJourneyData(token: string) {
  const res = await fetch("http://localhost:5000/api/student/journey", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ThesisPipelinePage() {
  const session = await auth();
  const data = await getJourneyData(session?.user?.accessToken || "");

  if (!data) {
    return (
      <div className="text-red-500 p-4">
        Failed to load thesis data. Is the backend running?
      </div>
    );
  }

  const hasAdviser =
    data.adviserAssignments && data.adviserAssignments.length > 0;
  const passedCompExam =
    data.compExamRecords &&
    data.compExamRecords.length > 0 &&
    data.compExamRecords[0].status === "PASSED";
  const currentThesis = data.thesisRecords?.[0] || null;

  // Define the master states based on real database data
  const isTitleCompleted =
    currentThesis &&
    (currentThesis.stage === "PROPOSAL" ||
      currentThesis.stage === "FINAL" ||
      (currentThesis.stage === "TITLE" && currentThesis.status === "PASSED"));
  const isProposalCompleted =
    currentThesis &&
    (currentThesis.stage === "FINAL" ||
      (currentThesis.stage === "PROPOSAL" &&
        currentThesis.status === "PASSED"));

  const getStageStatus = (
    stageName: string,
    isCompleted: boolean,
    isLocked: boolean,
  ) => {
    if (isLocked) return "locked";
    if (isCompleted) return "completed";
    if (currentThesis && currentThesis.stage === stageName) {
      if (currentThesis.status === "PENDING") return "pending";
      if (currentThesis.status === "SCHEDULED") return "approved";
      if (currentThesis.status === "FAILED") return "failed";
    }
    return "ready";
  };

  const stages = [
    {
      key: "title_defense",
      label: "Title Defense",
      href: "/student/thesis/title-defense",
      status: getStageStatus("TITLE", !!isTitleCompleted, !hasAdviser || !passedCompExam), // Locked if no adviser OR failed Comp Exam
      requirements: [
        { name: "Passed Comprehensive Exam", met: passedCompExam },
        { name: "Must have an Assigned Adviser", met: hasAdviser },
        {
          name: "Three Proposed Titles",
          met: currentThesis?.stage === "TITLE" || isTitleCompleted,
        },
      ],
      panel: null, // Will be populated in Phase 4 Scheduling
    },
    {
      key: "proposal_defense",
      label: "Proposal Defense",
      href: "/student/thesis/proposal-defense",
      status: getStageStatus(
        "PROPOSAL",
        !!isProposalCompleted,
        !isTitleCompleted,
      ), // Locked until Title is Passed
      requirements: [
        { name: "Passed Title Defense", met: !!isTitleCompleted },
        {
          name: "Chapters 1-3 Uploaded",
          met: currentThesis?.stage === "PROPOSAL" || isProposalCompleted,
        },
      ],
      panel: null,
    },
    {
      key: "final_defense",
      label: "Final Defense",
      href: "/student/thesis/final-defense",
      status: getStageStatus(
        "FINAL",
        currentThesis?.stage === "FINAL" && currentThesis?.status === "PASSED",
        !isProposalCompleted,
      ), // Locked until Proposal Passed
      requirements: [
        { name: "Passed Proposal Defense", met: !!isProposalCompleted },
        {
          name: "Final Manuscript Uploaded",
          met: currentThesis?.stage === "FINAL",
        },
      ],
      panel: null,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "locked":
        return (
          <Badge className="bg-gray-100 text-gray-500">
            <Lock className="mr-1 h-3 w-3" />
            Locked
          </Badge>
        );
      case "ready":
        return (
          <Badge className="bg-blue-100 text-blue-700">Ready to Apply</Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" />
            Application Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Scheduled
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700">
            <Lock className="mr-1 h-3 w-3" />
            Failed / Revise
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Passed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Thesis Pipeline
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Overview of your defense stages — Title, Proposal, and Final Defense
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {stages.map((stage) => {
          const isLocked = stage.status === "locked";
          const requirementsMet = stage.requirements.every((r) => r.met);

          return (
            <Card key={stage.key} className={isLocked ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                    {stage.label}
                  </CardTitle>
                  {getStatusBadge(stage.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[var(--earist-secondary)]">
                      Requirements
                    </p>
                    <div className="space-y-1.5">
                      {stage.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {req.met ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          <span
                            className={`text-xs ${req.met ? "text-[var(--earist-body-text)]" : "text-gray-400"}`}
                          >
                            {req.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[var(--earist-border-gray)] pt-3">
                    <div className="border-t border-[var(--earist-border-gray)] pt-3">
                      {stage.key === "title_defense" && (!hasAdviser || !passedCompExam) ? (
                        <div className="flex flex-col gap-2">
                          {!passedCompExam && (
                            <p className="text-xs text-red-500 font-medium">
                              <Lock className="inline h-3 w-3 mr-1" />
                              You must pass the Comprehensive Exam first.
                            </p>
                          )}
                          {!hasAdviser && passedCompExam && (
                            <Link
                              href="/student/thesis/adviser-request"
                              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--earist-primary)] hover:text-[var(--earist-accent)]"
                            >
                              <Users className="h-3 w-3" /> Request Adviser{" "}
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={stage.href}
                          className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors ${
                            isLocked
                              ? "cursor-not-allowed text-gray-400 pointer-events-none"
                              : "text-[var(--earist-secondary)] hover:text-[var(--earist-primary)]"
                          }`}
                        >
                          {isLocked ? (
                            <>
                              {" "}
                              <Lock className="h-3 w-3" /> Locked{" "}
                            </>
                          ) : stage.status === "completed" ? (
                            <>
                              {" "}
                              View Details{" "}
                              <ArrowRight className="h-3 w-3" />{" "}
                            </>
                          ) : (
                            <>
                              {" "}
                              Apply / View Details{" "}
                              <ArrowRight className="h-3 w-3" />{" "}
                            </>
                          )}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
