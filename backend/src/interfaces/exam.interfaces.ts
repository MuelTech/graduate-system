/**
 * Bounded ADMIN read model for a single Entrance Exam Record detail.
 *
 * This DTO deliberately exposes only authoritative exam-record data needed by
 * the Admin detail page. It never includes correct-answer/option data.
 */

export interface ExamRecordEssayAnswer {
  questionId: string;
  questionText: string;
  order: number;
  essayAnswer: string | null;
}

export interface ExamRecordDetail {
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
}
