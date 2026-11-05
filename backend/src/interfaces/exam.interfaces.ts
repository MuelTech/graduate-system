/**
 * Bounded ADMIN read model for a single Entrance Exam Record detail.
 *
 * This DTO deliberately exposes only authoritative exam-record data needed by
 * the Admin detail page. It never includes correct-answer/option data.
 */

import type { ApplicantExamQuestion } from "./exam-content.interfaces";

export type EssayEvaluation = {
  status: "PENDING" | "COMPLETED";
  questionId: string;
  question: ApplicantExamQuestion;
  responseText: string | null;
  responseState: "SUBMITTED" | "BLANK" | "MISSING";
  maximumScore: number;
  essayScore: number | null;
  evaluator: { id: string; firstName: string; lastName: string } | null;
  evaluatedAt: string | null;
} | { status: "STAFF_REVIEW" | "LEGACY" | "UNAVAILABLE"; reason: string };

export interface ExamRecordEssayAnswer {
  questionId: string;
  questionText: string;
  order: number;
  essayAnswer: string | null;
}

export interface ExamRecordDetail {
  canAmendAppointment: boolean;
  canReconsiderResult: boolean;
  computedStatus: string;
  effectiveStatus: string;
  institutionalDecision: { decision: "PASSED_RECONSIDERED"; decidedAt: string } | null;
  seatReleasedAt: string | null;
  replacementOfApplicationId: string | null;
  scheduleAmendment: {
    id: string; type: string; status: string; reason: string; requestedAt: string;
    requestedBy: { id: string; firstName: string; lastName: string };
    decisionReason: string | null; decidedAt: string | null;
    decidedBy: { id: string; firstName: string; lastName: string } | null;
    replacementApplicationId: string | null;
    targetSlot: { id: string; examDate: string; examTime: string } | null;
  } | null;
  reconsideration: { decision: "PASSED_RECONSIDERED"; decidedAt: string; reason: string; decidedBy: { id: string; firstName: string; lastName: string } } | null;
  result: ReturnType<typeof import("../services/exam-result.rules").resultProjection> | null;
  resultEmailEligible: boolean;
  id: string;
  status: string;
  student: {
    id: string;
    pinnacleApplicantId: string | null;
    user: { firstName: string; lastName: string; email: string };
  };
  program: {
    id: string;
    programName: string;
    /** Configured maximum when present; null = not authoritatively available. */
    examMcqTotal: number | null;
    examEssayTotal: number | null;
  };
  slot: { id: string; examDate: string; examTime: string };
  score: {
    multipleChoiceScore: number | null;
    essayScore: number | null;
    totalScore: number | null;
    status: string;
    gradedBy: { id: string; firstName: string; lastName: string } | null;
  } | null;
  essayAnswers: ExamRecordEssayAnswer[];
  essayEvaluation: EssayEvaluation;
}
