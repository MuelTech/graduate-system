import type { InstitutionalLogos } from "../shared/institutional-header";
import type { PdfImageInput } from "../shared/pdf-layout";

/** Display values only. Identity, request, date, and signing authority belong to the caller. */
export interface AdviserRequestRenderInput {
  readonly logos: InstitutionalLogos;
  /** Display-ready text, printed verbatim without date parsing or formatting. */
  readonly requestDate: string;
  /** The sole Adviser identity, reused in the request and CONFORME areas. */
  readonly requestedAdviserName: string;
  readonly reason: string;
  readonly studentName: string;
  readonly studentNumber: string;
  readonly programName: string;
  /** Explicit PNG/JPEG bytes; omission leaves the signature area blank. */
  readonly studentSignature?: PdfImageInput;
}
