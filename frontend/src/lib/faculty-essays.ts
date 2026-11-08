import { ApiError } from "./api-error";

export interface EssayQueueItem {
  applicationId: string;
  applicant: {
    firstName: string;
    lastName: string;
    pinnacleApplicantId: string;
  };
  programName: string;
  examDate: string | null;
  finalizedAt: string;
  status: "PENDING";
}
export interface EssayPage {
  items: EssayQueueItem[];
  nextCursor: string | null;
}
export interface EssayDetail extends EssayQueueItem {
  questionId: string;
  question: {
    questionText: string;
    questionTextEmphasis?: unknown;
    stimulusType: "NONE" | "IMAGE" | "STRUCTURED";
    stimulusMediaId: string | null;
    structuredStimulus: unknown;
    structuredStimulusEmphasis?: unknown;
  };
  responseText: string | null;
  responseState: "MISSING" | "BLANK" | "SUBMITTED";
  maximumScore: number;
}
export const essayEndpoint = (id?: string) =>
  `/exam/essay-evaluations${id ? `/${encodeURIComponent(id)}` : ""}`;
export const essayMediaEndpoint = (id: string, mediaId: string) =>
  `${essayEndpoint(id)}/media/${encodeURIComponent(mediaId)}/content`;

/** Seek visible work, never mistake an empty candidate scan for exhaustion.
 * Each request must advance; abort/errors remain failures, never empty results.
 */
export async function visibleEssayPage(
  fetchPage: (cursor: string | null) => Promise<EssayPage>,
  after: string | null,
): Promise<EssayPage> {
  let cursor = after;
  const seen = new Set<string>();
  for (;;) {
    if (cursor) seen.add(cursor);
    const page = await fetchPage(cursor);
    if (
      !page ||
      !Array.isArray(page.items) ||
      (page.nextCursor !== null && typeof page.nextCursor !== "string") ||
      (page.nextCursor !== null &&
        (!page.nextCursor ||
          seen.has(page.nextCursor) ||
          (cursor !== null && page.nextCursor <= cursor)))
    ) {
      throw new ApiError(
        "The evaluation list could not be loaded. Try again.",
        503,
      );
    }
    if (page.items.length || page.nextCursor === null) return page;
    cursor = page.nextCursor;
  }
}

export function scoreInput(value: string, maximum: number): number | null {
  if (!value.trim()) return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= maximum
    ? score
    : null;
}

export function essayError(error: unknown): string {
  const status = error instanceof ApiError ? error.statusCode : undefined;
  if (status === 400) return "Check the essay score and try again.";
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403)
    return "Your access has changed. Return to the Dashboard.";
  if (status === 404 || status === 409)
    return "This essay is no longer available for evaluation.";
  if (status === 503)
    return "Essay Evaluations is temporarily unavailable. Try again.";
  return "Unable to load Essay Evaluations. Try again.";
}
