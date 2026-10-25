export interface AdviserRequestReviewContext {
  studentId: string;
  studentName: string;
  studentNumber: string;
  programName: string;
  requestedAdviserName: string;
  sourceDefenseScheduleId: string;
}

export interface AdviserRequestReview {
  requestedAdviserId: string;
  reason: string;
  reviewedContext: AdviserRequestReviewContext;
}

/** Capture a review once when the dialog opens. Background query refresh cannot change signed content. */
export function captureAdviserRequestReview(review: AdviserRequestReview): AdviserRequestReview {
  return { requestedAdviserId: review.requestedAdviserId, reason: review.reason, reviewedContext: { ...review.reviewedContext } };
}

export function adviserRequestSigningReady(review: AdviserRequestReview | null, signature: string): boolean {
  return Boolean(review?.requestedAdviserId && Object.values(review.reviewedContext).every(value => value.trim())
    && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(signature));
}

export function signedAdviserRequestSubmission(review: AdviserRequestReview | null, signature: string) {
  if (!adviserRequestSigningReady(review, signature) || !review) throw new Error("Review and sign the adviser request before submitting.");
  return { ...captureAdviserRequestReview(review), signatureData: signature };
}
