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
import type {
  CorExtractionResult,
  ExtractedPage,
} from "./cor-extraction.types";

const PDF_MIME = "application/pdf";
const MAX_PERSISTED_PAGES = 100;
const MAX_PERSISTED_ITEMS = 20_000;
const MAX_DIAGNOSTIC_CHARS = 500;

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

  /** Caps page count and overall positional-item budget for persistence. */
  private boundPages(pages: ExtractedPage[]): ExtractedPage[] {
    let budget = MAX_PERSISTED_ITEMS;
    return pages.slice(0, MAX_PERSISTED_PAGES).map((page) => {
      const items = budget > 0 ? page.items.slice(0, budget) : [];
      budget -= items.length;
      return { ...page, items };
    });
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
          diagnostic:
            "Native PDF extraction does not apply to this upload; OCR strategy may be applicable later.",
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
          diagnostic: `Unable to resolve COR file for extraction: ${this.message(error)}`,
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
            text: native.text,
            pages: this.boundPages(native.pages),
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
          diagnostic:
            "No useful native text found; OCR fallback is applicable but not implemented in DL-4.",
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
          diagnostic: `Native extraction failed: ${this.message(error)}`,
        }),
      );
    }
  }

  private message(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.length > MAX_DIAGNOSTIC_CHARS
      ? text.slice(0, MAX_DIAGNOSTIC_CHARS)
      : text;
  }
}
