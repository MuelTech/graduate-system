import { AppError } from "../utils/AppError";

/** UTF-16 code units, matching the submission UI; comfortably inside MySQL TEXT capacity. */
export const MANUSCRIPT_TITLE_MAX_LENGTH = 2000;

/** Explicit academic title only: trim edges without rewriting capitalization or content. */
export function normalizeManuscriptTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("Thesis/Dissertation Title is required.", 400);
  }
  const title = value.trim();
  if (title.length > MANUSCRIPT_TITLE_MAX_LENGTH) {
    throw new AppError(`Thesis/Dissertation Title must be ${MANUSCRIPT_TITLE_MAX_LENGTH} characters or fewer.`, 400);
  }
  return title;
}
