import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock(
  "../../../../frontend/src/components/exam-content/exam-media-image",
  () => ({ ExamMediaImage: () => null }),
);
import {
  StructuredStimulusRenderer,
  StimulusRenderer,
} from "../../../../frontend/src/components/exam-content/stimulus-renderer";
import { SemanticText } from "../../../../frontend/src/components/exam-content/semantic-text";
const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");
const span = { start: 0, end: 3, style: "ITALIC" };
const render = (component: unknown, props: unknown) =>
  renderToStaticMarkup(createElement(component, props));
const read = (file: string) =>
  fs.readFileSync(path.resolve("../frontend/src", file), "utf8");

describe("controlled italic and structured item React rendering", () => {
  it.each([
    [["ITALIC"], "<em>abc</em>"],
    [["BOLD", "ITALIC"], '<strong class="font-bold"><em>abc</em></strong>'],
    [["UNDERLINE", "ITALIC"], "<u><em>abc</em></u>"],
    [
      ["BOLD", "UNDERLINE", "ITALIC"],
      '<strong class="font-bold"><u><em>abc</em></u></strong>',
    ],
  ])("renders deterministic semantic nesting %#", (styles, expected) => {
    expect(
      render(SemanticText, {
        text: "abc",
        emphasis: (styles as string[]).map((style) => ({ ...span, style })),
      }),
    ).toContain(expected);
  });
  it.each([
    "WORD_SERIES",
    "WORD_BANK",
    "ALPHANUMERIC_SEQUENCE",
    "LETTER_SEQUENCE",
    "LOGICAL_PREMISES",
  ])("renders supported %s items through SemanticText", (type) => {
    const html = render(StructuredStimulusRenderer, {
      stimulus: {
        type,
        items: type === "LETTER_SEQUENCE" ? ["a", "b"] : ["abc", "other"],
      },
      emphasis: [
        {
          index: 0,
          spans: [{ ...span, end: type === "LETTER_SEQUENCE" ? 1 : 3 }],
        },
      ],
    });
    expect(html).toContain(
      type === "LETTER_SEQUENCE" ? "<em>a</em>" : "<em>abc</em>",
    );
    expect(html.match(/<em>/g)).toHaveLength(1);
  });
  it("escapes markup even inside formatted items and falls back for malformed metadata", () => {
    const stimulus = { type: "WORD_SERIES", items: ["<script>x</script>"] };
    const html = render(StructuredStimulusRenderer, {
      stimulus,
      emphasis: [{ index: 0, spans: [{ ...span, end: 8 }] }],
    });
    expect(html).toContain("<em>&lt;script&gt;</em>");
    expect(html).not.toContain("<script>");
    for (const emphasis of [
      [{ index: 4, spans: [span] }],
      [{ index: 0, spans: [{ ...span, end: 99 }] }],
    ]) {
      const fallback = render(StructuredStimulusRenderer, {
        stimulus,
        emphasis,
      });
      expect(fallback).toContain("&lt;script&gt;x&lt;/script&gt;");
      expect(fallback).not.toContain("<em>");
    }
  });
  it("retains numeric/grid rendering and plain text with no metadata", () => {
    expect(
      render(StructuredStimulusRenderer, {
        stimulus: { type: "NUMBER_SEQUENCE", items: [1, "?"] },
        emphasis: [{ index: 0, spans: [span] }],
      }),
    ).not.toContain("<em>");
    const grid = render(StructuredStimulusRenderer, {
      stimulus: { type: "MATRIX", rows: [[1, "?"]] },
      emphasis: [{ index: 0, spans: [span] }],
    });
    expect(grid).toContain("<table");
    expect(grid).not.toContain("<em>");
    const plain = render(StructuredStimulusRenderer, {
      stimulus: { type: "WORD_SERIES", items: ["abc  \nxyz"] },
    });
    expect(plain).toContain("abc  \nxyz");
    expect(plain).not.toContain("<em>");
  });
  it("passes metadata through the common stimulus wrapper", () => {
    expect(
      render(StimulusRenderer, {
        stimulusType: "STRUCTURED",
        stimulusMediaId: null,
        structuredStimulus: { type: "WORD_SERIES", items: ["abc"] },
        structuredStimulusEmphasis: [{ index: 0, spans: [span] }],
      }),
    ).toContain("<em>abc</em>");
  });
  it("wires Italic selection, shared item editor, safe clear, preview and both consumers", () => {
    const semanticEditor = read(
      "components/exam-content/semantic-text-editor.tsx",
    );
    expect(semanticEditor).toContain('["ITALIC", "Italic"]');
    expect(semanticEditor).toContain("bold, underline, or italic");
    const editor = read(
      "components/exam-content/structured-stimulus-editor.tsx",
    );
    expect(editor).toContain("<SemanticTextEditor");
    expect(editor).toContain("structuredDraftEmphasisAfterEdit");
    expect(editor).toContain("index !== columnIndex");
    for (const file of [
      "components/exam-content/admin-question-editor.tsx",
      "components/exam-content/applicant-question-renderer.tsx",
      "app/(portal)/admin/exam/questions/page.tsx",
      "app/(portal)/applicant/exam/page.tsx",
    ]) {
      expect(read(file)).toMatch(/structuredStimulusEmphasis=\{/);
    }
    expect(read("components/exam-content/admin-question-editor.tsx")).toContain(
      "structuredStimulusEmphasis: null",
    );
    for (const file of [
      "components/exam-content/semantic-text.tsx",
      "components/exam-content/stimulus-renderer.tsx",
      "components/exam-content/structured-stimulus-editor.tsx",
    ])
      expect(read(file)).not.toContain("dangerouslySetInnerHTML");
  });
});
