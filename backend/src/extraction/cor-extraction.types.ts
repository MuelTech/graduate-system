/**
 * DL-4: generic COR text-extraction types.
 *
 * These carry PDF information only. They deliberately contain no EARIST
 * field/parser semantics (no Student Number, Name, Program, College, Academic
 * Year, or Semester). Field mapping is DL-5 and remains blocked until
 * authoritative COR samples exist.
 */

export type CorExtractionStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "MANUAL_REQUIRED"
  | "FAILED";

export type CorExtractionMethodValue = "NATIVE_PDF" | "OCR" | "MANUAL";

export interface ExtractedPositionalItem {
  text: string;
  /** 1-based page number. */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPage {
  /** 1-based page number. */
  page: number;
  text: string;
  items: ExtractedPositionalItem[];
}

/** Raw output of a native PDF text extraction pass. */
export interface NativePdfExtraction {
  pageCount: number;
  /** Normalized text across all pages. */
  text: string;
  pages: ExtractedPage[];
}

/** Persistable extraction result for one CorUpload. */
export interface CorExtractionResult {
  status: CorExtractionStatusValue;
  method: CorExtractionMethodValue | null;
  extractorVersion: string | null;
  pageCount: number | null;
  text: string | null;
  pages: ExtractedPage[] | null;
  /** Future parser suggestions; stays null/empty until DL-5. */
  suggestions: unknown | null;
  diagnostic: string | null;
  processedAt: Date | null;
}
