import { setQuestion, mediaId } from "./exam-question-set";

export const executionIds = {
  app: "11111111-1111-4111-8111-111111111111", user: "22222222-2222-4222-8222-222222222222",
  student: "33333333-3333-4333-8333-333333333333", slot: "44444444-4444-4444-8444-444444444444",
  program: "55555555-5555-4555-8555-555555555555", admin: "66666666-6666-4666-8666-666666666666",
  revision: "77777777-7777-4777-8777-777777777777",
};
export const configuration = { examDurationMinutes: 120, mcqPointsPerCorrectItem: 2, essayMaximumScore: 25, passingThreshold: null };
export function executionApplication() {
  const ids = executionIds;
  const date = new Date("2026-11-03T00:00:00Z"), time = new Date("1970-01-01T09:00:00Z");
  return { id: ids.app, studentId: ids.student, programId: ids.program, slotId: ids.slot, status: "PENDING",
    examDate: date, examTime: time, actualStartedAt: null, deadlineAt: null, executionConfiguration: null, contentRevisionId: null,
    startAuthorizedAt: null, startAuthorizedById: null, startAuthorizedBy: null,
    student: { id: ids.student, userId: ids.user, programId: ids.program, admissionStatus: "APPLICANT", alignmentStatus: "ALIGNED", pinnacleApplicantId: "B4-SYNTHETIC", user: { role: "APPLICANT", isActive: true } },
    slot: { id: ids.slot, programId: ids.program, examDate: date, examTime: time, isActive: true, maxSlots: 1, slotsTaken: 1 },
    program: { programName: "Synthetic Graduate Program" }, score: null, _count: { answers: 0 },
  };
}
export function executionRevision(id = executionIds.revision) {
  return { id, publishedAt: new Date("2026-11-02T00:00:00Z"), questions: [{ questionId: setQuestion().id, position: 0, content: setQuestion() }], media: [{ mediaId }] };
}
