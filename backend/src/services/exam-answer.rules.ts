import { AppError } from "../utils/AppError";

function invalid(message: string): never { throw new AppError(message, 400); }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Answer payload must be an object.");
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid("Answer payload contains unsupported fields.");
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid(`${name} must be an opaque UUID.`);
  }
  // Canonical UUID case prevents aliases from bypassing duplicate detection.
  return value.toLowerCase();
}

function essay(value: unknown): string {
  // Match the existing MySQL TEXT storage capacity, without a word-count policy.
  // Empty text is an explicit B5 clear; B6 leaves it unanswered.
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 65_535) {
    invalid("essayAnswer must be text of at most 65535 UTF-8 bytes.");
  }
  return value;
}

export type ExamDraftInput = { expectedRevision: number; questionId: string } & (
  | { selectedOptionId: string | null; essayAnswer?: never }
  | { essayAnswer: string; selectedOptionId?: never }
);

export function validateDraft(value: unknown): ExamDraftInput {
  const data = object(value);
  keys(data, ["questionId", "expectedRevision", "selectedOptionId", "essayAnswer"]);
  const questionId = identifier(data.questionId, "questionId");
  if (!Number.isInteger(data.expectedRevision) || (data.expectedRevision as number) < 0 || (data.expectedRevision as number) >= 2_147_483_647) {
    invalid("expectedRevision must be a nonnegative database integer below its maximum.");
  }
  const expectedRevision = data.expectedRevision as number;
  const hasOption = Object.prototype.hasOwnProperty.call(data, "selectedOptionId");
  const hasEssay = Object.prototype.hasOwnProperty.call(data, "essayAnswer");
  if (hasOption === hasEssay) invalid("Supply exactly one answer representation.");
  return hasOption
    ? { questionId, expectedRevision, selectedOptionId: data.selectedOptionId === null ? null : identifier(data.selectedOptionId, "selectedOptionId") }
    : { questionId, expectedRevision, essayAnswer: essay(data.essayAnswer) };
}
