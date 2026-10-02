import fsp from "fs/promises";
import type {
  ExtractedPage,
  ExtractedPositionalItem,
  NativePdfExtraction,
} from "./cor-extraction.types";

/**
 * DL-4: native PDF text extractor backed by PDF.js (`pdfjs-dist`).
 *
 * PDF.js exposes `getTextContent()` items with positional transforms, which
 * future deterministic parser work (DL-5) will need. This module is generic:
 * it never maps text to EARIST COR fields.
 *
 * `pdfjs-dist` v6 ships the Node-compatible build as ESM
 * (`legacy/build/pdf.mjs`). This repository compiles to CommonJS, and
 * TypeScript would rewrite `await import()` into `require()`, so the native
 * dynamic import is preserved explicitly. No browser worker is used.
 */

export const NATIVE_PDF_EXTRACTOR_VERSION = "pdfjs-dist@6.3.289:native-1";

/** Minimum non-whitespace characters to consider native text useful. */
export const MIN_USEFUL_NATIVE_CHARS = 20;

/** Bounds so we never persist unbounded payloads. */
export const MAX_EXTRACTED_TEXT_CHARS = 200_000;
export const MAX_ITEMS_PER_PAGE = 5_000;

interface PdfJsTextItem {
  str: string;
  hasEOL?: boolean;
  width?: number;
  height?: number;
  transform?: number[];
}
interface PdfJsTextContent {
  items: Array<PdfJsTextItem | { type?: string }>;
}
interface PdfJsPage {
  getTextContent(): Promise<PdfJsTextContent>;
}
interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}
interface PdfJsLoadingTask {
  promise: Promise<PdfJsDocument>;
  destroy(): Promise<void>;
}
interface PdfJsModule {
  getDocument(input: Record<string, unknown>): PdfJsLoadingTask;
  version?: string;
}

const PDFJS_MODULE_SPECIFIER = "pdfjs-dist/legacy/build/pdf.mjs";

let pdfjsPromise: Promise<PdfJsModule> | null = null;

function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    // Non-literal specifier keeps TypeScript from resolving pdfjs ESM types.
    // This downlevels to `require()` under CommonJS, which Node >= 22 resolves
    // for ESM; Vitest executes it as a native dynamic import.
    pdfjsPromise = (
      import(PDFJS_MODULE_SPECIFIER) as Promise<unknown>
    ).then((mod) => mod as PdfJsModule);
  }
  return pdfjsPromise;
}

function isTextItem(
  item: PdfJsTextItem | { type?: string },
): item is PdfJsTextItem {
  return typeof (item as PdfJsTextItem).str === "string";
}

export function hasUsefulNativeText(text: string | null | undefined): boolean {
  return String(text ?? "").replace(/\s+/g, "").length >= MIN_USEFUL_NATIVE_CHARS;
}

function clampText(text: string): string {
  return text.length > MAX_EXTRACTED_TEXT_CHARS
    ? text.slice(0, MAX_EXTRACTED_TEXT_CHARS)
    : text;
}

export class NativePdfTextExtractor {
  get version(): string {
    return NATIVE_PDF_EXTRACTOR_VERSION;
  }

  async extract(filePath: string): Promise<NativePdfExtraction> {
    const bytes = await fsp.readFile(filePath);
    const pdfjs = await loadPdfjs();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });

    try {
      const pdf = await loadingTask.promise;
      const pages: ExtractedPage[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const items: ExtractedPositionalItem[] = [];
        let pageText = "";

        for (const raw of content.items) {
          if (!isTextItem(raw)) continue;
          if (!raw.str) {
            if (raw.hasEOL) pageText += "\n";
            continue;
          }

          const transform = raw.transform ?? [];
          items.push({
            text: raw.str,
            page: pageNumber,
            x: Number(transform[4] ?? 0),
            y: Number(transform[5] ?? 0),
            width: Number(raw.width ?? 0),
            height: Number(raw.height ?? 0),
          });

          pageText += raw.str;
          if (raw.hasEOL) pageText += "\n";
          if (items.length >= MAX_ITEMS_PER_PAGE) break;
        }

        pages.push({
          page: pageNumber,
          text: pageText.trim(),
          items,
        });
      }

      const text = clampText(
        pages
          .map((p) => p.text)
          .filter((t) => t.length > 0)
          .join("\n"),
      );

      return { pageCount: pdf.numPages, text, pages };
    } finally {
      await loadingTask.destroy().catch(() => {
        // best-effort resource cleanup
      });
    }
  }
}
