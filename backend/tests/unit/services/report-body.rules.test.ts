import { describe, expect, it } from "vitest";

import {
  REPORT_BODY_LIMITS,
  canonicalizeReportDocument,
  hasMeaningfulReportContent,
  hashReportDocument,
  serializeReportDocument,
  validateReportDocument,
} from "../../../src/services/report-body.rules";

const VALID_DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Suggestions" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The committee ", marks: ["italic"] },
        { type: "text", text: "recommends", marks: ["bold", "underline"] },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Revise title" }] }] },
      ],
    },
  ],
};

describe("validateReportDocument (CDW-1 committee report body)", () => {
  it("accepts a valid controlled document", () => {
    expect(validateReportDocument(VALID_DOC).ok).toBe(true);
  });

  it("accepts an empty document", () => {
    expect(validateReportDocument({ type: "doc", content: [] }).ok).toBe(true);
  });

  it("rejects non-object and wrong-root payloads", () => {
    expect(validateReportDocument(null).ok).toBe(false);
    expect(validateReportDocument("doc").ok).toBe(false);
    expect(validateReportDocument([]).ok).toBe(false);
    expect(validateReportDocument({ type: "paragraph", content: [] }).ok).toBe(false);
    expect(validateReportDocument({ type: "doc", content: "nope" }).ok).toBe(false);
  });

  it("rejects unknown node types", () => {
    expect(
      validateReportDocument({
        type: "doc",
        content: [{ type: "blockquote", content: [] }],
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown marks", () => {
    expect(
      validateReportDocument({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["strike"] }] }],
      }).ok,
    ).toBe(false);
  });

  it("rejects out-of-range heading levels", () => {
    for (const level of [0, 4, 1.5, "2"]) {
      expect(
        validateReportDocument({
          type: "doc",
          content: [{ type: "heading", attrs: { level }, content: [{ type: "text", text: "x" }] }],
        }).ok,
      ).toBe(false);
    }
  });

  it("rejects a text node without text", () => {
    expect(
      validateReportDocument({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text" }] }],
      }).ok,
    ).toBe(false);
  });

  it("rejects documents that exceed the node budget", () => {
    const paragraph = { type: "paragraph", content: [{ type: "text", text: "x" }] };
    expect(
      validateReportDocument({
        type: "doc",
        content: Array.from({ length: REPORT_BODY_LIMITS.maxNodes + 1 }, () => paragraph),
      }).ok,
    ).toBe(false);
  });

  it("rejects documents that exceed the depth budget", () => {
    let node: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "x" }] };
    for (let i = 0; i < REPORT_BODY_LIMITS.maxDepth + 2; i += 1) {
      node = { type: "bulletList", content: [{ type: "listItem", content: [node] }] };
    }
    expect(validateReportDocument({ type: "doc", content: [node] }).ok).toBe(false);
  });
});

describe("canonicalizeReportDocument / hashReportDocument", () => {
  it("produces identical canonical output regardless of key order", () => {
    const a = { type: "text", text: "hello", marks: ["bold"] };
    const b = { marks: ["bold"], text: "hello", type: "text" };
    expect(serializeReportDocument({ type: "doc", content: [{ type: "paragraph", content: [a] }] })).toBe(
      serializeReportDocument({ type: "doc", content: [{ type: "paragraph", content: [b] }] }),
    );
  });

  it("sorts and de-duplicates marks deterministically", () => {
    const one = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["underline", "bold", "bold"] }] }],
    };
    const two = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["bold", "underline"] }] }],
    };
    expect(serializeReportDocument(one)).toBe(serializeReportDocument(two));
    expect(serializeReportDocument(one)).toContain('"marks":["bold","underline"]');
  });

  it("produces a stable 64-char SHA-256 hex hash", () => {
    const hash = hashReportDocument(VALID_DOC);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashReportDocument(VALID_DOC)).toBe(hash);
  });

  it("changes the hash when the content changes", () => {
    const changed = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "different" }] }],
    };
    expect(hashReportDocument(changed)).not.toBe(hashReportDocument(VALID_DOC));
  });

  it("hashing is key-order independent", () => {
    const a = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "z", marks: ["italic"] }] }] };
    const b = { content: [{ content: [{ marks: ["italic"], text: "z", type: "text" }], type: "paragraph" }], type: "doc" };
    expect(hashReportDocument(a as never)).toBe(hashReportDocument(b as never));
  });

  it("rejects nothing silently: canonicalize assumes an already-validated document", () => {
    // Sanity: canonicalizing VALID_DOC does not throw and is JSON-serializable.
    expect(canonicalizeReportDocument(VALID_DOC)).toBeDefined();
    expect(() => JSON.parse(serializeReportDocument(VALID_DOC))).not.toThrow();
  });
});

describe("hasMeaningfulReportContent (CDW-1 freeze gate)", () => {
  it("rejects an empty document", () => {
    expect(hasMeaningfulReportContent({ type: "doc", content: [] })).toBe(false);
  });

  it("rejects an empty paragraph", () => {
    expect(hasMeaningfulReportContent({ type: "doc", content: [{ type: "paragraph", content: [] }] })).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    expect(
      hasMeaningfulReportContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "   \n\t " }] }],
      }),
    ).toBe(false);
  });

  it("rejects a document that only contains hard breaks", () => {
    expect(
      hasMeaningfulReportContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "hardBreak" }, { type: "hardBreak" }] }],
      }),
    ).toBe(false);
  });

  it("accepts meaningful narrative content", () => {
    expect(
      hasMeaningfulReportContent({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Revise the title" }] }],
      }),
    ).toBe(true);
  });

  it("accepts meaningful content nested inside lists", () => {
    expect(
      hasMeaningfulReportContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
