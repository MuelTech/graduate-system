import { storageService } from "../storage";
import type { StorageService } from "../storage/storage.service";
import { CorRepository } from "../repositories/cor.repository";
import { CorExtractionRepository } from "../repositories/cor-extraction.repository";
import {
  NativePdfTextExtractor,
  hasUsefulNativeText,
} from "./native-pdf.extractor";
import {
  UnavailableOcrExtractor,
  type OcrExtractor,
} from "./ocr.extractor";
import { boundExtractionPages, capExtractedText } from "./extraction-bounds";
import type { CorExtractionResult } from "./cor-extraction.types";

const PDF_MIME = "application/pdf";

/**
 * DL-4: controlled, client-safe extraction diagnostics.
 *
 * Only these values are ever persisted and surfaced to Admin DTOs/UI. Raw
 * `Error.message` values are never persisted because Node filesystem errors can
 * embed absolute private storage paths; parser errors can embed implementation
 * detail. Internal technical errors are intentionally not persisted.
 */
const DIAGNOSTIC = {
  NON_PDF:
    "Native PDF extraction does not apply to this upload; manual review required.",
  NO_USEFUL_TEXT:
    "No useful native text found; manual review required.",
  READ_FAILED: "Unable to read stored COR document.",
  PARSE_FAILED: "Native PDF parsing failed.",
} as const;

const READ_ERROR_CODES = new Set(["ENOENT", "EACCES", "EPERM", "EISDIR"]);

/**
 * DL-4: best-effort native COR extraction orchestrator.
 *
 * Extraction is assistive only. It never verifies a COR, never writes
 * Admin-confirmed `CorRecord` values, and never touches enrollment, Student
 * Number, or User role. It is tied to an exact `corUploadId`, and each upload
 * (including rejected/resubmitted history) keeps its own extraction row.
 */
export class CorExtractionService {
  constructor(
    private readonly native: NativePdfTextExtractor = new NativePdfTextExtractor(),
    private readonly ocr: OcrExtractor = new UnavailableOcrExtractor(),
    private readonly corRepository: CorRepository = new CorRepository(),
    private readonly extractionRepository: CorExtractionRepository = new CorExtractionRepository(),
    private readonly storage: StorageService = storageService,
  ) {}

  private terminal(
    partial: Omit<CorExtractionResult, "processedAt">,
  ): CorExtractionResult {
    return { ...partial, processedAt: new Date() };
  }

  private async persist(
    corUploadId: string,
    result: CorExtractionResult,
  ): Promise<CorExtractionResult> {
    await this.extractionRepository.upsertResult(corUploadId, result);
    return result;
  }

  /** Maps an internal error to a controlled, path-free persisted diagnostic. */
  private sanitizeDiagnostic(error: unknown): string {
    const code = (error as { code?: string } | null)?.code;
    if (code && READ_ERROR_CODES.has(code)) {
      return DIAGNOSTIC.READ_FAILED;
    }
    return DIAGNOSTIC.PARSE_FAILED;
  }

  async processUpload(corUploadId: string): Promise<CorExtractionResult> {
    const source = await this.corRepository.getExtractionSource(corUploadId);
    if (!source) {
      throw new Error("CorUpload not found for extraction.");
    }

    const mime = source.detectedMimeType ?? null;

    // Non-PDF (JPEG/PNG) — native PDF extraction does not apply.
    if (mime !== PDF_MIME) {
      return this.persist(
        corUploadId,
        this.terminal({
          status: "MANUAL_REQUIRED",
          method: "MANUAL",
          extractorVersion: null,
          pageCount: null,
          text: null,
          pages: null,
          suggestions: null,
          diagnostic: DIAGNOSTIC.NON_PDF,
        }),
      );
    }

    await this.persist(corUploadId, {
      status: "PROCESSING",
      method: "NATIVE_PDF",
      extractorVersion: this.native.version,
      pageCount: null,
      text: null,
      pages: null,
      suggestions: null,
      diagnostic: null,
      processedAt: null,
    });

    let localPath: string;
    try {
      localPath = await this.storage.resolveReadPath({
        storageKey: source.storageKey,
        filePath: source.filePath,
      });
    } catch {
      return this.persist(
        corUploadId,
        this.terminal({
          status: "FAILED",
          method: "NATIVE_PDF",
          extractorVersion: this.native.version,
          pageCount: null,
          text: null,
          pages: null,
          suggestions: null,
          diagnostic: DIAGNOSTIC.READ_FAILED,
        }),
      );
    }

    try {
      const native = await this.native.extract(localPath);

      if (hasUsefulNativeText(native.text)) {
        return this.persist(
          corUploadId,
          this.terminal({
            status: "COMPLETED",
            method: "NATIVE_PDF",
            extractorVersion: this.native.version,
            pageCount: native.pageCount,
            text: capExtractedText(native.text),
            pages: boundExtractionPages(native.pages),
            suggestions: null,
            diagnostic: null,
          }),
        );
      }

      // OCR remains a future strategy. When unavailable, manual fallback.
      if (this.ocr.isAvailable()) {
        // Reserved for a future OCR strategy; DL-4 never executes OCR.
      }

      return this.persist(
        corUploadId,
        this.terminal({
          status: "MANUAL_REQUIRED",
          method: "NATIVE_PDF",
          extractorVersion: this.native.version,
          pageCount: native.pageCount,
          text: null,
          pages: null,
          suggestions: null,
          diagnostic: DIAGNOSTIC.NO_USEFUL_TEXT,
        }),
      );
    } catch (error) {
      return this.persist(
        corUploadId,
        this.terminal({
          status: "FAILED",
          method: "NATIVE_PDF",
          extractorVersion: this.native.version,
          pageCount: null,
          text: null,
          pages: null,
          suggestions: null,
          diagnostic: this.sanitizeDiagnostic(error),
        }),
      );
    }
  }
}
