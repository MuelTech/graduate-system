import { AppError } from "../utils/AppError";

/** Composition applies to publication/new binding, never to generic bank editing. */
export function singleEssay<T extends { type: string }>(questions: T[]): T {
  const essays = questions.filter(question => question.type === "ESSAY");
  if (essays.length !== 1) throw new AppError("The examination must contain exactly one essay question. Review the Question Set before publishing or starting.", 409);
  return essays[0];
}

export function essayScoreValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError("Essay score must be a finite JSON number greater than or equal to zero.", 400);
  }
  return value;
}

export function essayEvaluationBody(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, "essayScore")) {
    throw new AppError("Supply only essayScore as a JSON number.", 400);
  }
  return essayScoreValue((value as Record<string, unknown>).essayScore);
}
