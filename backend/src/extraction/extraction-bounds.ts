import type { ExtractedPage, ExtractedPositionalItem } from "./cor-extraction.types";
import { MAX_EXTRACTED_TEXT_CHARS } from "./native-pdf.extractor";

/**
 * DL-4 persistence bounds.
 *
 * Compressed PDF content can expand substantially into text/layout data, so
 * persistence must be deterministic and bounded. These limits are character
 * budgets (application-level), applied before the `pages`/`text` JSON is
 * stored. They are intentionally conservative and generic (no EARIST
 * semantics) and keep enough positional data for future DL-5 parsing.
 */

/** Maximum number of pages persisted. */
export const MAX_PERSISTED_PAGES = 100;
/** Maximum total positional items persisted across all pages. */
export const MAX_PERSISTED_ITEMS = 20_000;
/** Maximum characters persisted for a single page's text. */
export const MAX_PAGE_TEXT_CHARS_PER_PAGE = 2_000;
/** Maximum aggregate characters persisted across all page texts. */
export const MAX_PAGE_TEXT_CHARS_TOTAL = 20_000;
/** Maximum characters persisted for a single positional item's text. */
export const MAX_ITEM_TEXT_CHARS_PER_ITEM = 500;
/** Maximum aggregate characters persisted across all positional item texts. */
export const MAX_ITEM_TEXT_CHARS_TOTAL = 60_000;

/** Re-exported so callers can bound the top-level normalized text. */
export { MAX_EXTRACTED_TEXT_CHARS };

function takeChars(value: string, limit: number): string {
  if (limit <= 0) return "";
  return value.length <= limit ? value : value.slice(0, limit);
}

/** Bounds the top-level normalized extracted text. */
export function capExtractedText(text: string | null | undefined): string {
  return takeChars(String(text ?? ""), MAX_EXTRACTED_TEXT_CHARS);
}

/**
 * Bounds page count, total positional item count, per-page text, aggregate
 * page text, per-item text and aggregate item text. Items beyond the aggregate
 * character budget are dropped (their positions are not persisted) rather than
 * persisted unbounded.
 */
export function boundExtractionPages(pages: ExtractedPage[]): ExtractedPage[] {
  const bounded: ExtractedPage[] = [];
  let remainingItems = MAX_PERSISTED_ITEMS;
  let remainingPageText = MAX_PAGE_TEXT_CHARS_TOTAL;
  let remainingItemText = MAX_ITEM_TEXT_CHARS_TOTAL;

  for (const page of pages) {
    if (bounded.length >= MAX_PERSISTED_PAGES || remainingItems <= 0) break;

    const pageText = takeChars(
      page.text,
      Math.min(MAX_PAGE_TEXT_CHARS_PER_PAGE, remainingPageText),
    );
    remainingPageText -= pageText.length;

    const items: ExtractedPositionalItem[] = [];
    for (const item of page.items) {
      if (remainingItems <= 0 || remainingItemText <= 0) break;
      const text = takeChars(
        item.text,
        Math.min(MAX_ITEM_TEXT_CHARS_PER_ITEM, remainingItemText),
      );
      remainingItemText -= text.length;
      items.push({ ...item, text });
      remainingItems -= 1;
    }

    bounded.push({ page: page.page, text: pageText, items });
  }

  return bounded;
}
