import type { AdviserRequest, AdviserRequestSignedState } from "@prisma/client";
import { adviserRequestEvidenceHash, ADVISER_REQUEST_CONTRACT, type SignedAdviserRequestState } from "../../src/services/adviser-request-signed-state";

/** Synthetic one-pixel test evidence; no real person's signature. */
export const STUDENT_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";
export const REVIEW_CONTEXT = { studentId: "student-1", studentName: "Sam Student", studentNumber: "2026-001",
  programName: "MIT", requestedAdviserName: "Ana Chair", sourceDefenseScheduleId: "schedule-1" };

export function signedRequestEvidence(request: Pick<AdviserRequest, "id" | "studentId" | "requestedAdviserId" | "reason" | "requestDate" | "sourceDefenseScheduleId">): AdviserRequestSignedState {
  const state: SignedAdviserRequestState = {
    ...REVIEW_CONTEXT, contractVersion: ADVISER_REQUEST_CONTRACT, requestId: request.id,
    studentId: request.studentId, studentUserId: "student-user", requestedAdviserId: request.requestedAdviserId,
    reason: request.reason ?? "", sourceDefenseScheduleId: request.sourceDefenseScheduleId!, sourceConclusionId: "conclusion-1",
    requestDate: request.requestDate.toISOString().slice(0, 10), requestDateDisplay: "25 September 2026", signedAt: "2026-09-25T08:00:00.123Z",
  };
  return { requestId: request.id, payload: state as never, signatureData: STUDENT_SIGNATURE,
    evidenceHash: adviserRequestEvidenceHash(state, STUDENT_SIGNATURE), signedAt: new Date(state.signedAt) };
}
