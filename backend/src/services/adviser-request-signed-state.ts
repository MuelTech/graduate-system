import { createHash } from "node:crypto";
import type { AdviserRequest, AdviserRequestSignedState } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { validateOfficialFormSignatureImage } from "./official-form-signature-image";

export const ADVISER_REQUEST_CONTRACT = "GS020-REV00-V1";

export interface AdviserRequestReviewContext {
  studentId: string;
  studentName: string;
  studentNumber: string;
  programName: string;
  requestedAdviserName: string;
  sourceDefenseScheduleId: string;
}

export interface SignedAdviserRequestState extends AdviserRequestReviewContext {
  contractVersion: string;
  requestId: string;
  studentUserId: string;
  requestedAdviserId: string;
  sourceConclusionId: string;
  reason: string;
  requestDate: string;
  requestDateDisplay: string;
  signedAt: string;
}

/** Canonical ordering survives MySQL JSON key reordering. This is an integrity guard, not a signature. */
export function adviserRequestEvidenceHash(payload: object, signatureData: string): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return createHash("sha256").update(JSON.stringify(canonical(payload))).update("\0").update(signatureData).digest("hex");
}

export async function validateStudentRequestSignature(value: string | null | undefined) {
  try { return await validateOfficialFormSignatureImage(value); }
  catch (error) {
    throw new AppError("A valid Student signature (PNG or JPEG) is required to submit the adviser request.",
      error instanceof AppError ? error.statusCode : 422);
  }
}

export function parseSignedAdviserRequestState(value: unknown): SignedAdviserRequestState {
  const state = value as SignedAdviserRequestState | null;
  const required = ["requestId", "studentId", "studentUserId", "studentName", "studentNumber", "programName",
    "requestedAdviserId", "requestedAdviserName", "sourceDefenseScheduleId", "sourceConclusionId",
    "requestDate", "requestDateDisplay", "signedAt"] as const;
  if (!state || state.contractVersion !== ADVISER_REQUEST_CONTRACT || typeof state.reason !== "string"
    || required.some(key => typeof state[key] !== "string" || !state[key].trim())
    || !/^\d{4}-\d{2}-\d{2}$/.test(state.requestDate) || !Number.isFinite(Date.parse(state.signedAt))) {
    throw new AppError("The signed adviser request is incomplete or unsupported.", 409);
  }
  return state;
}

/** No normal update path can replace evidence; transitions also reject changed signed content. */
export function assertSignedAdviserRequest(
  request: Pick<AdviserRequest, "id" | "studentId" | "requestedAdviserId" | "reason" | "sourceDefenseScheduleId" | "requestDate">,
  evidence: AdviserRequestSignedState | null,
): SignedAdviserRequestState {
  if (!evidence) throw new AppError("This request has no authoritative Student signature. A new signed request is required.", 409);
  const state = parseSignedAdviserRequestState(evidence.payload);
  if (evidence.requestId !== request.id || state.requestId !== request.id || state.studentId !== request.studentId
    || state.requestedAdviserId !== request.requestedAdviserId || state.reason !== (request.reason ?? "")
    || state.sourceDefenseScheduleId !== request.sourceDefenseScheduleId
    || state.requestDate !== request.requestDate.toISOString().slice(0, 10)
    || state.signedAt !== evidence.signedAt.toISOString()
    || adviserRequestEvidenceHash(state, evidence.signatureData) !== evidence.evidenceHash) {
    throw new AppError("The signed adviser request has changed. Its Adviser, content, identity, and signature cannot be replaced.", 409);
  }
  return state;
}
