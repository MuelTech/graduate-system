// CDW-5 — Rapporteur rich-text Committee Report authoring foundation.
//
// Framework-free logic checks over the report document module + static source
// contracts over the authoring/read-only UI.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw5-report.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  emptyReportDocument,
  normalizeReportDocument,
  isReportDocumentEmpty,
  commentTextToContent,
} from "../src/lib/report/report-document.ts";
import {
  fromTiptapDocument,
  toTiptapDocument,
} from "../src/lib/report/tiptap-adapter.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const exists = (relative) => existsSync(resolve(root, relative));

const PKG = "package.json";
const EDITOR = "src/components/defense-workspace/rich-text-report-editor.tsx";
const TOOLBAR = "src/components/defense-workspace/report-editor-toolbar.tsx";
const VIEW = "src/components/defense-workspace/report-document-view.tsx";
const CSS = "src/components/defense-workspace/report-body.css";
const INDENT = "src/components/defense-workspace/report-paragraph-indent.ts";
const FORMATTING = "src/components/defense-workspace/report-paragraph-formatting.ts";
const PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const BRIDGE = "src/components/defense-workspace/report-composer-context.tsx";
const RAIL = "src/components/defense-workspace/shared-comments-rail.tsx";
const THREAD = "src/components/defense-workspace/annotation-thread.tsx";
const PROVIDER = "src/components/defense-workspace/student-document-collaboration.tsx";

// ---- Framework-free report document logic ---------------------------------

test("normalizeReportDocument fills missing content arrays and drops invalid attrs", () => {
  const normalized = normalizeReportDocument({
    type: "doc",
    content: [
      { type: "paragraph" },
      { type: "paragraph", attrs: { textAlign: null } },
      {
        type: "heading",
        attrs: { level: 2, textAlign: null },
        content: [{ type: "text", text: "Hi", marks: ["bold", "bogus"] }],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem" }, { type: "listItem", content: [{ type: "paragraph" }] }],
      },
    ],
  });
  assert.equal(normalized.type, "doc");
  assert.deepEqual(normalized.content[0].content, []);
  assert.equal(normalized.content[1].attrs, undefined);
  assert.equal(normalized.content[2].attrs.textAlign, undefined);
  assert.equal(normalized.content[2].attrs.level, 2);
  assert.deepEqual(normalized.content[2].content[0].marks, ["bold"]);
  assert.deepEqual(normalized.content[3].content[0].content, []);
});

test("isReportDocumentEmpty treats empty paragraphs as empty and text as meaningful", () => {
  assert.equal(isReportDocumentEmpty(emptyReportDocument()), true);
  assert.equal(
    isReportDocumentEmpty({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
    }),
    true,
  );
  assert.equal(
    isReportDocumentEmpty({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Real" }] }],
    }),
    false,
  );
});

test("commentTextToContent preserves the FULL comment text (no truncation)", () => {
  const long = `Line one ${"x".repeat(400)}\nLine two\n\nLine three`;
  const content = commentTextToContent(long);
  assert.equal(content.length, 3);
  const rejoined = content
    .map((block) => block.content.map((node) => node.text).join(""))
    .join("\n");
  assert.equal(rejoined, `Line one ${"x".repeat(400)}\nLine two\nLine three`);
  assert.ok(rejoined.includes("x".repeat(400)));
});

// ---- Tiptap ⇄ canonical adapters (REAL Tiptap-shaped marks) ---------------

test("fromTiptapDocument converts Tiptap mark OBJECTS to canonical string marks", () => {
  const canonical = fromTiptapDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Example", marks: [{ type: "bold" }, { type: "italic" }] },
        ],
      },
    ],
  });
  assert.deepEqual(canonical.content[0].content[0].marks, ["bold", "italic"]);
});

test("bold + italic + underline all survive Tiptap → canonical", () => {
  const canonical = fromTiptapDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "underline" }, { type: "bold" }, { type: "italic" }],
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    [...canonical.content[0].content[0].marks].sort(),
    ["bold", "italic", "underline"],
  );
});

test("toTiptapDocument converts canonical string marks to Tiptap mark objects", () => {
  const tiptap = toTiptapDocument({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "x", marks: ["bold"] }] },
    ],
  });
  assert.deepEqual(tiptap.content[0].content[0].marks, [{ type: "bold" }]);
});

test("round trip canonical → Tiptap → canonical preserves formatting", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Heading", marks: ["bold", "underline"] }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Body ", marks: [] },
          { type: "text", text: "italic", marks: ["italic"] },
          { type: "hardBreak" },
          { type: "text", text: "after", marks: [] },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "item", marks: ["bold"] }],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "one", marks: [] }] }],
          },
        ],
      },
    ],
  };
  assert.deepEqual(fromTiptapDocument(toTiptapDocument(canonical)), canonical);
});

test("round trip Tiptap → canonical → Tiptap preserves formatting", () => {
  const tiptap = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "x", marks: [{ type: "bold" }, { type: "underline" }] },
        ],
      },
    ],
  };
  const roundTrip = toTiptapDocument(fromTiptapDocument(tiptap));
  assert.deepEqual(roundTrip.content[0].content[0].marks, [
    { type: "bold" },
    { type: "underline" },
  ]);
});

test("unsupported marks never become canonical content", () => {
  const canonical = fromTiptapDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "x", marks: [{ type: "strike" }, { type: "code" }] },
        ],
      },
    ],
  });
  assert.deepEqual(canonical.content[0].content[0].marks, []);
});

test("heading/list/hardBreak structures survive the adapters", () => {
  const tiptap = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "H" }] },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "p" },
          { type: "hardBreak" },
          { type: "text", text: "q" },
        ],
      },
    ],
  };
  const canonical = fromTiptapDocument(tiptap);
  assert.equal(canonical.content[0].type, "heading");
  assert.equal(canonical.content[0].attrs.level, 3);
  assert.equal(canonical.content[1].type, "bulletList");
  assert.equal(canonical.content[1].content[0].content[0].type, "paragraph");
  assert.equal(canonical.content[2].content[1].type, "hardBreak");
  const roundTrip = toTiptapDocument(canonical);
  assert.equal(roundTrip.content[2].content[1].type, "hardBreak");
});

test("save/reload model preserves bold/italic/underline", () => {
  const canonical = fromTiptapDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }],
          },
        ],
      },
    ],
  });
  // Simulate the JSON round trip through server storage and reload.
  const reloaded = normalizeReportDocument(JSON.parse(JSON.stringify(canonical)));
  assert.deepEqual(reloaded.content[0].content[0].marks, [
    "bold",
    "italic",
    "underline",
  ]);
});

// ---- textAlign preservation (canonical field, no toolbar) -----------------

test("canonical centered paragraph survives canonical → Tiptap → canonical", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [{ type: "text", text: "center", marks: [] }],
      },
    ],
  };
  const tiptap = toTiptapDocument(canonical);
  assert.equal(tiptap.content[0].attrs.textAlign, "center");
  assert.equal(fromTiptapDocument(tiptap).content[0].attrs.textAlign, "center");
});

test("canonical justified paragraph survives the round trip", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [{ type: "text", text: "j", marks: [] }],
      },
    ],
  };
  assert.equal(
    fromTiptapDocument(toTiptapDocument(canonical)).content[0].attrs.textAlign,
    "justify",
  );
});

test("canonical centered heading survives the round trip", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, textAlign: "center" },
        content: [{ type: "text", text: "H", marks: [] }],
      },
    ],
  };
  const back = fromTiptapDocument(toTiptapDocument(canonical));
  assert.equal(back.content[0].attrs.level, 2);
  assert.equal(back.content[0].attrs.textAlign, "center");
  assert.deepEqual(back, canonical);
});

test("left/right alignment also survive", () => {
  for (const align of ["left", "right"]) {
    const canonical = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: align },
          content: [{ type: "text", text: "x", marks: [] }],
        },
      ],
    };
    assert.equal(
      fromTiptapDocument(toTiptapDocument(canonical)).content[0].attrs.textAlign,
      align,
    );
  }
});

test("an invalid alignment never becomes canonical", () => {
  const canonical = fromTiptapDocument({
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "upside-down" },
        content: [{ type: "text", text: "x" }],
      },
    ],
  });
  assert.equal(canonical.content[0].attrs, undefined);
});

test("alignment AND marks are preserved together", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [{ type: "text", text: "x", marks: ["bold", "italic"] }],
      },
    ],
  };
  const tiptap = toTiptapDocument(canonical);
  assert.equal(tiptap.content[0].attrs.textAlign, "center");
  assert.deepEqual(tiptap.content[0].content[0].marks, [
    { type: "bold" },
    { type: "italic" },
  ]);
  const back = fromTiptapDocument(tiptap);
  assert.equal(back.content[0].attrs.textAlign, "center");
  assert.deepEqual(back.content[0].content[0].marks, ["bold", "italic"]);
});

// ---- Paragraph indentation (CDW-5 authoring ergonomics) -------------------

test("paragraph indentLevel survives canonical → Tiptap → canonical", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { indentLevel: 2 },
        content: [{ type: "text", text: "x", marks: [] }],
      },
    ],
  };
  const tiptap = toTiptapDocument(canonical);
  assert.equal(tiptap.content[0].attrs.indentLevel, 2);
  assert.deepEqual(fromTiptapDocument(tiptap), canonical);
});

test("textAlign and indentLevel survive the round trip together", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "center", indentLevel: 3 },
        content: [{ type: "text", text: "x", marks: [] }],
      },
    ],
  };
  const back = fromTiptapDocument(toTiptapDocument(canonical));
  assert.equal(back.content[0].attrs.textAlign, "center");
  assert.equal(back.content[0].attrs.indentLevel, 3);
  assert.deepEqual(back, canonical);
});

test("marks and indentLevel survive the round trip together", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { indentLevel: 1 },
        content: [{ type: "text", text: "x", marks: ["bold", "italic"] }],
      },
    ],
  };
  const back = fromTiptapDocument(toTiptapDocument(canonical));
  assert.equal(back.content[0].attrs.indentLevel, 1);
  assert.deepEqual(back.content[0].content[0].marks, ["bold", "italic"]);
  assert.deepEqual(back, canonical);
});

test("invalid indentLevel never becomes accepted canonical content", () => {
  for (const bad of [-1, 7, 1.5, "2", null, true]) {
    const normalized = normalizeReportDocument({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { indentLevel: bad }, content: [{ type: "text", text: "x" }] },
      ],
    });
    assert.equal(normalized.content[0].attrs, undefined, `indentLevel ${String(bad)} must be dropped`);
  }
  // Level 0 is canonicalized to omission, matching the server.
  const zero = normalizeReportDocument({
    type: "doc",
    content: [
      { type: "paragraph", attrs: { indentLevel: 0 }, content: [{ type: "text", text: "x" }] },
    ],
  });
  assert.equal(zero.content[0].attrs, undefined);
});

test("indentLevel survives a persisted save/reload JSON round trip", () => {
  const canonical = {
    type: "doc",
    content: [
      { type: "paragraph", attrs: { indentLevel: 4 }, content: [{ type: "text", text: "x" }] },
    ],
  };
  const reloaded = normalizeReportDocument(JSON.parse(JSON.stringify(canonical)));
  assert.equal(reloaded.content[0].attrs.indentLevel, 4);
});

test("the paragraph indentation renderer emits bounded data-indent-level", () => {
  const v = read(VIEW);
  assert.match(v, /data-indent-level/);
  // No arbitrary style/pixel indentation in the renderer.
  assert.doesNotMatch(v, /marginLeft|margin-left|paddingLeft/);
  const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.cdwReportBody p\[data-indent-level="1"\]/);
  assert.match(css, /\.cdwReportBody p\[data-indent-level="6"\]/);
  // Bounded: no selector above the supported maximum.
  assert.doesNotMatch(css, /data-indent-level="(?:7|8|9)/);
});

test("the editor implements semantic Tab / Shift+Tab indentation", () => {
  const indent = read(INDENT);
  assert.match(indent, /Tab:\s*\(\{\s*editor\s*\}\)\s*=>/);
  assert.match(indent, /"Shift-Tab":\s*\(\{\s*editor\s*\}\)\s*=>/);
  // Lists use structural nesting, not literal tabs/spaces.
  assert.match(indent, /sinkListItem/);
  assert.match(indent, /liftListItem/);
  // Plain paragraphs use a bounded canonical attr.
  assert.match(indent, /updateAttributes\("paragraph"/);
  assert.match(indent, /REPORT_INDENT_MAX\s*=\s*6/);
  // No text/spaces/tabs are ever inserted to fake indentation.
  assert.doesNotMatch(indent, /insertContent|insertText/);
  // No pagination concepts leak in through the extension.
  assert.doesNotMatch(indent, /pageBreak|page-break|@page|break-inside|297mm|210mm/i);
  // Registered by the editor, which still speaks canonical JSON at the boundary.
  const e = read(EDITOR);
  assert.match(e, /ReportParagraphIndent/);
});

// ---- Word-like academic formatting (CDW-5) --------------------------------

test("canonical 11pt and 12pt survive canonical → Tiptap → canonical", () => {
  for (const fontSizePt of [11, 12]) {
    const canonical = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { fontSizePt },
          content: [{ type: "text", text: "x", marks: [] }],
        },
      ],
    };
    assert.equal(toTiptapDocument(canonical).content[0].attrs.fontSizePt, fontSizePt);
    assert.deepEqual(fromTiptapDocument(toTiptapDocument(canonical)), canonical);
  }
});

test("unsupported font sizes never become canonical content", () => {
  for (const bad of [10, 13, 11.5, "11", null, true]) {
    const normalized = normalizeReportDocument({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { fontSizePt: bad }, content: [{ type: "text", text: "x" }] },
      ],
    });
    assert.equal(normalized.content[0].attrs, undefined, `fontSizePt ${String(bad)} must be dropped`);
  }
});

test("every supported line spacing survives canonical → Tiptap → canonical", () => {
  for (const lineSpacing of [1, 1.15, 1.5, 2, 2.5, 3]) {
    const canonical = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { lineSpacing },
          content: [{ type: "text", text: "x", marks: [] }],
        },
      ],
    };
    assert.equal(toTiptapDocument(canonical).content[0].attrs.lineSpacing, lineSpacing);
    assert.deepEqual(fromTiptapDocument(toTiptapDocument(canonical)), canonical);
  }
});

test("invalid line spacing never becomes canonical content", () => {
  for (const bad of [1.2, 2.25, 0, -1, "1.5", null]) {
    const normalized = normalizeReportDocument({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { lineSpacing: bad }, content: [{ type: "text", text: "x" }] },
      ],
    });
    assert.equal(normalized.content[0].attrs, undefined, `lineSpacing ${String(bad)} must be dropped`);
  }
});

test("alignment + size + spacing + indent + marks survive together", () => {
  const canonical = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "justify", indentLevel: 1, fontSizePt: 11, lineSpacing: 1.5 },
        content: [{ type: "text", text: "x", marks: ["bold", "italic", "underline"] }],
      },
    ],
  };
  assert.deepEqual(fromTiptapDocument(toTiptapDocument(canonical)), canonical);
});

test("the read-only renderer emits the same paragraph formatting semantics", () => {
  const v = read(VIEW);
  assert.match(v, /data-indent-level/);
  assert.match(v, /data-font-size-pt/);
  assert.match(v, /data-line-spacing/);
  assert.match(v, /textAlign: align/);
  // No arbitrary style/pixel formatting in the renderer.
  assert.doesNotMatch(v, /fontSize:|lineHeight:|marginLeft|fontFamily/);
});

test("the document body uses the fixed Arial font stack", () => {
  const css = read(CSS);
  assert.match(css, /font-family:\s*Arial,\s*Helvetica,\s*sans-serif/);
});

test("the document body text is black (no leftover web-gray document colors)", () => {
  const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.cdwReportBody\s*\{[^}]*color:\s*#000000/is);
  assert.doesNotMatch(css, /#2b2f36|#1c1f24/i);
});

test("the document CSS maps the bounded sizes and line spacings", () => {
  const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /p\[data-font-size-pt="11"\]/);
  assert.match(css, /p\[data-font-size-pt="12"\]/);
  for (const spacing of ["1", "1.15", "1.5", "2", "2.5", "3"]) {
    assert.match(css, new RegExp(`p\\[data-line-spacing="${spacing.replace(".", "\\.")}"\\]`));
  }
  // Bounded: no unapproved spacing selector exists.
  assert.doesNotMatch(css, /data-line-spacing="(?:1\.2|2\.25|0|4)"/);
});

test("the editor implements controlled paragraph font size + line spacing", () => {
  const formatting = read(FORMATTING);
  assert.match(formatting, /setReportFontSize/);
  assert.match(formatting, /setReportLineSpacing/);
  assert.match(formatting, /REPORT_FONT_SIZES_PT\s*=\s*\[11,\s*12\]/);
  assert.match(formatting, /REPORT_LINE_SPACINGS\s*=\s*\[1,\s*1\.15,\s*1\.5,\s*2,\s*2\.5,\s*3\]/);
  // No CSS strings / colors / fonts persisted from the extension.
  assert.doesNotMatch(formatting, /font-size:|line-height:|fontFamily|#000/i);
  // Registered by the editor.
  assert.match(read(EDITOR), /ReportParagraphFormatting/);
});

// ---- Dependency + file contracts ------------------------------------------

test("the rich-text editor dependency is present and minimal", () => {
  const pkg = JSON.parse(read(PKG));
  assert.ok(pkg.dependencies["@tiptap/react"], "@tiptap/react expected");
  assert.ok(pkg.dependencies["@tiptap/starter-kit"], "@tiptap/starter-kit expected");
  // No office-suite / PDF stack.
  for (const forbidden of ["jspdf", "html2canvas", "@react-pdf/renderer", "docx"]) {
    assert.equal(Boolean(pkg.dependencies[forbidden]), false, `${forbidden} must not be added`);
  }
});

test("CDW-5 components exist", () => {
  for (const file of [EDITOR, TOOLBAR, VIEW, PANEL, BRIDGE]) {
    assert.equal(exists(file), true, `${file} should exist`);
  }
});

test("the editor is configured to exactly the canonical document model", () => {
  const e = read(EDITOR);
  assert.match(e, /@tiptap\/starter-kit/);
  assert.match(e, /EditorContent/);
  assert.match(e, /heading:\s*\{\s*levels:\s*\[1,\s*2,\s*3\]/);
  for (const disabled of ["strike", "code", "codeBlock", "blockquote", "horizontalRule", "link"]) {
    assert.match(e, new RegExp(`${disabled}:\\s*false`), `${disabled} should be disabled`);
  }
  // Accessible editor label + no HTML.
  assert.match(e, /aria-label/);
  assert.doesNotMatch(e, /dangerouslySetInnerHTML/);
});

test("the editor uses the canonical TextAlign extension and exposes the four alignment controls", () => {
  const pkg = JSON.parse(read(PKG));
  assert.ok(
    pkg.dependencies["@tiptap/extension-text-align"],
    "@tiptap/extension-text-align expected",
  );
  const e = read(EDITOR);
  assert.match(e, /@tiptap\/extension-text-align/);
  assert.match(e, /TextAlign\.configure\(\{\s*types:\s*\["heading",\s*"paragraph"\]\s*\}\)/);
  const t = read(TOOLBAR);
  assert.match(t, /setTextAlign/);
  for (const label of ["Align left", "Align center", "Align right", "Justify"]) {
    assert.match(t, new RegExp(label), `${label} control expected`);
  }
  // Only the four canonical alignments (no vertical/other alignment features).
  assert.doesNotMatch(t, /AlignTop|AlignBottom|AlignStart|AlignEnd|setTextDirection/i);
});

test("the toolbar offers only a fixed Arial field and bounded selectors", () => {
  const t = read(TOOLBAR);
  // Arial is displayed as a fixed document font, never a selectable picker.
  assert.match(t, /Arial/);
  assert.doesNotMatch(t, /fontFamily|font-family|type="color"|textColor|setColor/i);
  // Font size: only 11 and 12.
  assert.match(t, /FONT_SIZES_PT\s*=\s*\[11,\s*12\]/);
  assert.match(t, /setReportFontSize/);
  // Line spacing: only the approved values.
  for (const label of ["1.0", "1.15", "1.5", "2.0", "2.5", "3.0"]) {
    assert.match(t, new RegExp(label.replace(".", "\\.")), `spacing ${label} expected`);
  }
  assert.match(t, /setReportLineSpacing/);
});

test("the toolbar exposes the required, accessible controls with pressed state", () => {
  const t = read(TOOLBAR);
  assert.match(t, /role="toolbar"/);
  assert.match(t, /aria-label/);
  assert.match(t, /aria-pressed/);
  for (const label of [
    "Undo",
    "Redo",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Bold",
    "Italic",
    "Underline",
    "Align left",
    "Align center",
    "Align right",
    "Justify",
    "Bullet list",
    "Numbered list",
    "Font size",
    "Line spacing",
  ]) {
    assert.match(t, new RegExp(label), `${label} control expected`);
  }
});

test("read-only rendering is semantic and XSS-safe (no HTML injection)", () => {
  const v = read(VIEW);
  assert.match(v, /ReportDocumentView/);
  assert.doesNotMatch(v, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(v, /<iframe/i);
  // Semantic elements for headings/lists.
  assert.match(v, /<h1|<h2|<h3/);
  assert.match(v, /<ul|<ol/);
});

test("the document canvas is shared by the editor, preview, and read-only view", () => {
  const css = read(CSS);
  assert.match(css, /\.cdwReportWorkspace\b/);
  assert.match(css, /\.cdwReportCanvas\b/);
  assert.match(css, /\.cdwReportBody\b/);

  const v = read(VIEW);
  assert.match(v, /export function ReportDocumentCanvas/);
  assert.match(v, /cdwReportWorkspace/);
  assert.match(v, /cdwReportCanvas/);

  // The authoring surface also uses the shared canvas wrapper.
  const e = read(EDITOR);
  assert.match(e, /ReportDocumentCanvas/);

  // Preview + read-only + authoring all reuse it (>= 3 uses in the panel/module).
  const p = read(PANEL);
  assert.ok(
    (p.match(/ReportDocumentCanvas/g) ?? []).length >= 3,
    "panel should reuse the shared canvas in preview and read-only",
  );
});

test("the report presentation stays pagination-free and print-free", () => {
  // Strip CSS comments so prose about pagination can never satisfy the check.
  const css = read(CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /@media\s+print/i);
  assert.doesNotMatch(css, /@page\b/i);
  assert.doesNotMatch(css, /page-break|break-before|break-after|break-inside/i);
  // No fixed A4 page height / physical page units.
  assert.doesNotMatch(css, /210mm|297mm|\b11in\b|\b8\.5in\b/i);
});

test("the report panel gates authoring on canEditBody and offers read-only otherwise", () => {
  const p = read(PANEL);
  assert.match(p, /canEditBody/);
  assert.match(p, /RichTextReportEditor/);
  assert.match(p, /ReportDocumentView/);
  // Save Draft + Preview Report for the author.
  assert.match(p, /Save Draft/);
  assert.match(p, /Preview Report/);
  // Empty state for read-only viewers.
  assert.match(p, /has not started the Committee Report/);
  // No mandatory fixed sections.
  assert.doesNotMatch(p, /Committee Suggestions|General Observations|Statement of the Problem/);
  // No evaluation controls.
  assert.doesNotMatch(p, /OralEvaluationForm|groupAAverage|overallAverage/);
});

test("no official-form / PDF / print implementation exists in this phase", () => {
  const combined =
    read(PANEL) + read(VIEW) + read(EDITOR) + read(TOOLBAR) + read(FORMATTING);
  assert.doesNotMatch(combined, /jsPDF|@react-pdf|html2canvas|window\.print|@media\s+print/i);
  assert.doesNotMatch(combined, /GS Form No\. 22|GS-022|Official Form Renderer/i);
});

test("Insert into Report copies the FULL comment body and is never a live binding", () => {
  const thread = read(THREAD);
  assert.match(thread, /Insert into Report/);
  const provider = read(PROVIDER);
  // Uses comment.body (full stored body), not a truncated preview.
  assert.match(provider, /insertComment\(comment\.body\)/);
  const bridge = read(BRIDGE);
  assert.match(bridge, /registerInsert/);
  assert.match(bridge, /insertComment/);
  // No source-comment mutation on insert.
  assert.doesNotMatch(thread, /updateAnnotation|deleteAnnotation|updateComment/);
});

test("the editor converts Tiptap JSON ⇄ canonical at the boundary (never HTML)", () => {
  const e = read(EDITOR);
  assert.match(e, /toTiptapDocument/);
  assert.match(e, /fromTiptapDocument/);
  assert.match(e, /insertContent/);
  assert.match(e, /commentTextToContent/);
  assert.doesNotMatch(e, /dangerouslySetInnerHTML/);
});

test("the Insert bridge follows the editor mount lifecycle (registered in the editor, cleared on unmount)", () => {
  const e = read(EDITOR);
  assert.match(e, /useReportComposer/);
  assert.match(e, /registerInsert\(/);
  assert.match(e, /return \(\) => registerInsert\(null\)/);
  // The panel must no longer own registration (fixes stale-handler-after-unmount).
  const p = read(PANEL);
  assert.doesNotMatch(p, /registerInsert/);
});

test("unsaved status reflects the local dirty flag only", () => {
  const p = read(PANEL);
  assert.match(p, /dirty \? "Draft \(unsaved\)" : "Draft"/);
  assert.doesNotMatch(p, /hasCollaborativeBody \|\| dirty/);
});

test("an editable legacy DRAFT stays visibly read-only and is not converted", () => {
  const p = read(PANEL);
  assert.match(p, /LegacyAuthoringNotice/);
  assert.match(p, /Legacy report content \(read-only\)/);
  assert.doesNotMatch(p, /importLegacy|convertLegacy|autoConvert/);
});

test("Shared Comments behavior is preserved and no realtime was added", () => {
  const rail = read(RAIL);
  assert.match(rail, /Selected/);
  assert.match(rail, /All Comments/);
  const combined = read(PANEL) + read(EDITOR) + read(BRIDGE) + rail + read(THREAD);
  assert.doesNotMatch(combined, /socket\.io|Socket\.IO|new WebSocket|io\(/);
});

test("Save Draft sends expectedBodyVersion for stale-draft (CAS) safety", () => {
  const p = read(PANEL);
  assert.match(p, /expectedBodyVersion/);
  assert.match(p, /method:\s*"PUT"/);
  assert.match(p, /collaboration\/report/);
});
