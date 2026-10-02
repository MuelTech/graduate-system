import type { NativePdfExtraction } from "./cor-extraction.types";

/**
 * DL-4: OCR strategy boundary only.
 *
 * No OCR is executed in DL-4 and `tesseract.js` is intentionally not used.
 * This interface exists so a future strategy (DL-4+/later) can plug into the
 * same extraction orchestrator without rewriting the native workflow.
 */
export interface OcrExtractionInput {
  filePath: string;
  mimeType: string | null;
}

export interface OcrExtractor {
  readonly method: "OCR";
  isAvailable(): boolean;
  extract(input: OcrExtractionInput): Promise<NativePdfExtraction>;
}

/** Default boundary: OCR is not implemented or executed in DL-4. */
export class UnavailableOcrExtractor implements OcrExtractor {
  readonly method = "OCR" as const;

  isAvailable(): boolean {
    return false;
  }

  async extract(): Promise<NativePdfExtraction> {
    throw new Error("OCR extraction is not implemented in DL-4.");
  }
}
