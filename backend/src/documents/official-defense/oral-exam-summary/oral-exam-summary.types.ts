import type { InstitutionalLogos } from "../shared/institutional-header";

export interface OralExamSummaryExaminerRow {
  readonly examinerName: string;
  /** Display values only; no scoring conversion or formula is applied. */
  readonly groupARating: string;
  readonly groupBRating: string;
  readonly average: string;
}

/** Empty strings/lists leave the corresponding printed slots blank. */
export interface OralExamSummaryRenderInput {
  readonly logos: InstitutionalLogos;
  readonly candidateName: string;
  readonly course: string;
  readonly date: string;
  readonly studentNumber: string;
  /** At most six rows, in caller-supplied order. Missing rows stay blank. */
  readonly examiners: readonly OralExamSummaryExaminerRow[];
  /** Explicit display names, independent of the examiner list. No signature evidence. */
  readonly submittedBy: {
    readonly chairmanName: string;
    readonly memberNames: readonly string[];
  };
  readonly adviserName: string;
  readonly deanName: string;
}
