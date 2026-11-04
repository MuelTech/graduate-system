import { executionApplication, configuration, executionIds } from "./exam-execution";
import { setQuestion, setEssay } from "./exam-question-set";

export function evaluationApplication(): any {
  const started = new Date("2026-11-01T01:00:00Z");
  return { ...executionApplication(), status: "TAKEN", actualStartedAt: started,
    deadlineAt: new Date(started.getTime() + 120 * 60_000), contentRevisionId: executionIds.revision,
    executionConfiguration: { ...configuration, essayMaximumScore: 25.5, timezone: "Asia/Manila", passingThresholdUnit: null },
    finalizedAt: new Date("2026-11-01T02:00:00Z"), finalizationReason: "APPLICANT_SUBMITTED",
    finalizationReceiptId: executionIds.app, finalizationAnsweredCount: 1, finalizationQuestionCount: 2,
    score: { multipleChoiceScore: 0, essayScore: null, totalScore: null, status: "PENDING", gradedById: null, gradedBy: null, essayEvaluatedAt: null },
    answers: [],
  };
}
export function evaluationRevision(): any {
  return { id: executionIds.revision, publishedAt: new Date("2026-11-01T00:00:00Z"), media: [],
    questions: [setQuestion(), setEssay()].map((content, position) => ({ questionId: content.id, position, content })) };
}
