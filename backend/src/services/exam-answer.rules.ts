import { AppError } from "../utils/AppError";

export type ExamAnswerInput =
  | { questionId: string; selectedOptionId: string; essayAnswer?: never }
  | { questionId: string; essayAnswer: string; selectedOptionId?: never };

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
  // Empty text is allowed; incomplete-answer policy remains unresolved (PD-4).
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 65_535) {
    invalid("essayAnswer must be text of at most 65535 UTF-8 bytes.");
  }
  return value;
}

export function validateAnswers(value: unknown): ExamAnswerInput[] {
  // Transport/work bound, not an assessment composition or completeness rule.
  if (!Array.isArray(value) || value.length > 1000) invalid("answers must be an array of at most 1000 entries.");
  const seen = new Set<string>();
  return value.map(entry => {
    const data = object(entry);
    keys(data, ["questionId", "selectedOptionId", "essayAnswer"]);
    const questionId = identifier(data.questionId, "questionId");
    if (seen.has(questionId)) invalid("Duplicate questionId entries are not allowed.");
    seen.add(questionId);
    const hasOption = Object.prototype.hasOwnProperty.call(data, "selectedOptionId");
    const hasEssay = Object.prototype.hasOwnProperty.call(data, "essayAnswer");
    if (hasOption === hasEssay) invalid("Supply exactly one answer representation.");
    return hasOption
      ? { questionId, selectedOptionId: identifier(data.selectedOptionId, "selectedOptionId") }
      : { questionId, essayAnswer: essay(data.essayAnswer) };
  });
}

export function validateSubmissionBody(value: unknown): ExamAnswerInput[] {
  const data = object(value);
  keys(data, ["answers"]);
  return validateAnswers(data.answers);
}

export function validateEssayAutosave(value: unknown): { questionId: string; essayAnswer: string } {
  const data = object(value);
  keys(data, ["questionId", "essayAnswer"]);
  return { questionId: identifier(data.questionId, "questionId"), essayAnswer: essay(data.essayAnswer) };
}
