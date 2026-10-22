import type { InstitutionalLogos } from "../shared/institutional-header";
import type { PdfImageInput } from "../shared/pdf-layout";

/** Printed matrix choices, not a scoring/conversion algorithm. null leaves a row unmarked. */
export type OralExamCriterionValue = "1.00" | "1.25" | "1.50" | "1.75" | "2.00" | "2.50";
type Choice = OralExamCriterionValue | null;

/** Every academic value is supplied by the caller; none is calculated by the renderer. */
export interface OralExamCriteriaRenderInput {
  readonly logos: InstitutionalLogos;
  readonly candidateName: string;
  readonly course: string;
  /** Display-ready date: no locale, timezone, or current-date inference. */
  readonly date: string;
  readonly groupI: readonly [Choice, Choice, Choice, Choice, Choice];
  readonly groupII: readonly [Choice, Choice, Choice, Choice];
  readonly groupIAverage: string;
  readonly groupIIAverage: string;
  readonly recommendations: string;
  readonly rating: string;
  readonly remarks: string;
  readonly evaluatorPrintedName: string;
  /** Already-authorized bytes supplied by a future integration layer, or blank for wet signing. */
  readonly evaluatorSignature?: PdfImageInput;
}
