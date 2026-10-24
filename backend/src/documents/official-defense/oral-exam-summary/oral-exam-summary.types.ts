import type { InstitutionalLogos } from "../shared/institutional-header";

export interface OralExamSummaryExaminerRow {
  readonly examinerName: string;
  /** Display values only; no scoring conversion or formula is applied. */
  readonly groupARating: string;
  readonly groupBRating: string;
  readonly average: string;
}

/**
 * Explicit print-stage discriminator. Title Defense has no Adviser seat and
 * omits the entire Adviser concurrence block; Proposal/Final retain it.
 */
export type OralExamSummaryStage = "title" | "proposal" | "final";

/** Empty strings/lists leave the corresponding printed slots blank. */
export interface OralExamSummaryRenderInput {
  readonly logos: InstitutionalLogos;
  /** Selects stage-specific signatory layout, never a data-fallback rule. */
  readonly stage: OralExamSummaryStage;
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
