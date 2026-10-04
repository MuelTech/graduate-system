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

/**
 * COR-1: deterministic EARIST COR parser output.
 *
 * Suggestion-only evidence for Admin review. These values are never
 * authoritative profile data and must never promote an Applicant; Admin
 * confirmation remains the sole verification authority.
 */
export interface CorStudentNameSuggestion {
  /** COR-displayed name after safe whitespace normalization. */
  raw: string;
  surname: string | null;
  firstName: string | null;
  middleNameOrInitial: string | null;
}

export interface CorExtractionSuggestions {
  studentNumber: string | null;
  registrationNumber: string | null;
  studentName: CorStudentNameSuggestion | null;
  program: string | null;
  college: string | null;
  emailAddress: string | null;
}

/** Persistable extraction result for one CorUpload. */
export interface CorExtractionResult {
  status: CorExtractionStatusValue;
  method: CorExtractionMethodValue | null;
  /** Native PDF extractor implementation version. */
  extractorVersion: string | null;
  /**
   * COR-2: EARIST COR parser version, kept distinct from `extractorVersion`.
   * Null when no parser ran (non-PDF, no useful text, or failure).
   */
  parserVersion: string | null;
  pageCount: number | null;
  text: string | null;
  pages: ExtractedPage[] | null;
  /**
   * COR-1 parser suggestions; null until the parser is wired into the
   * extraction pipeline (COR-2). Admin review consumes these as suggestions
   * only.
   */
  suggestions: CorExtractionSuggestions | null;
  diagnostic: string | null;
  processedAt: Date | null;
}
