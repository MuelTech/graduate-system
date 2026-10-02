import { describe, expect, it } from "vitest";
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_ITEM_TEXT_CHARS_PER_ITEM,
  MAX_ITEM_TEXT_CHARS_TOTAL,
  MAX_PAGE_TEXT_CHARS_PER_PAGE,
  MAX_PAGE_TEXT_CHARS_TOTAL,
  MAX_PERSISTED_ITEMS,
  MAX_PERSISTED_PAGES,
  boundExtractionPages,
  capExtractedText,
} from "../../../src/extraction/extraction-bounds";
import type { ExtractedPage } from "../../../src/extraction/cor-extraction.types";

function page(pageNumber: number, text: string, items: Array<{ text: string; page: number }>): ExtractedPage {
  return {
    page: pageNumber,
    text,
    items: items.map((i) => ({
      text: i.text,
      page: i.page,
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })),
  };
}

describe("boundExtractionPages — many small items", () => {
  it("caps total item count and page count", () => {
    const pages: ExtractedPage[] = [];
    for (let p = 1; p <= 300; p++) {
      const items = Array.from({ length: 200 }, () => ({ text: "x", page: p }));
      pages.push(page(p, "page text", items));
    }

    const bounded = boundExtractionPages(pages);
    const itemCount = bounded.reduce((sum, p) => sum + p.items.length, 0);

    expect(bounded.length).toBeLessThanOrEqual(MAX_PERSISTED_PAGES);
    expect(itemCount).toBeLessThanOrEqual(MAX_PERSISTED_ITEMS);
  });
});

describe("boundExtractionPages — few extremely large text items", () => {
  it("caps per-item text and aggregate item text", () => {
    const huge = "A".repeat(1_000_000);
    const pages = [page(1, huge, Array.from({ length: 5 }, () => ({ text: huge, page: 1 })))];

    const bounded = boundExtractionPages(pages);
    const itemTextTotal = bounded.reduce(
      (sum, p) => sum + p.items.reduce((s, i) => s + i.text.length, 0),
      0,
    );

    expect(bounded[0].items.every((i) => i.text.length <= MAX_ITEM_TEXT_CHARS_PER_ITEM)).toBe(true);
    expect(itemTextTotal).toBeLessThanOrEqual(MAX_ITEM_TEXT_CHARS_TOTAL);
  });

  it("caps per-page text and aggregate page text", () => {
    const huge = "B".repeat(1_000_000);
    const pages = Array.from({ length: 10 }, (_, i) => page(i + 1, huge, []));

    const bounded = boundExtractionPages(pages);
    const pageTextTotal = bounded.reduce((sum, p) => sum + p.text.length, 0);

    expect(bounded.every((p) => p.text.length <= MAX_PAGE_TEXT_CHARS_PER_PAGE)).toBe(true);
    expect(pageTextTotal).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARS_TOTAL);
  });
});

describe("capExtractedText", () => {
  it("caps the top-level normalized text", () => {
    const huge = "C".repeat(1_000_000);
    expect(capExtractedText(huge).length).toBe(MAX_EXTRACTED_TEXT_CHARS);
    expect(capExtractedText("short")).toBe("short");
    expect(capExtractedText(null)).toBe("");
  });
});
