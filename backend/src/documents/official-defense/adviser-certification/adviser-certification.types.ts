import type { InstitutionalLogos } from "../shared/institutional-header";
import type { PdfImageInput } from "../shared/pdf-layout";

/** GS-017 has no Title Defense selection. */
export type AdviserCertificationStage = "proposal" | "final";

/** Display data only. The caller owns all identity, date, and signature authority. */
export interface AdviserCertificationRenderInput {
  readonly logos: InstitutionalLogos;
  readonly manuscriptTitle: string;
  /** Printed both after "presented by" and on the request/name continuation line. */
  readonly studentName: string;
  readonly programName: string;
  readonly stage: AdviserCertificationStage;
  /** Display-ready values; no Date parsing, current date, timezone, or ordinal inference. */
  readonly issuedDay: string;
  readonly issuedMonthYear: string;
  readonly adviserPrintedName: string;
  /** Explicit PNG/JPEG bytes, or omitted for a blank signature area. No retrieval. */
  readonly adviserSignature?: PdfImageInput;
}
