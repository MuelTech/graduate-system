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

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const exists = (relative) => existsSync(resolve(root, relative));

const PKG = "package.json";
const EDITOR = "src/components/defense-workspace/rich-text-report-editor.tsx";
const TOOLBAR = "src/components/defense-workspace/report-editor-toolbar.tsx";
const VIEW = "src/components/defense-workspace/report-document-view.tsx";
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
    "Bullet list",
    "Numbered list",
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
    read(PANEL) + read(VIEW) + read(EDITOR) + read(TOOLBAR);
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

test("the editor inserts via structured content (never HTML)", () => {
  const p = read(PANEL);
  assert.match(p, /insertContent/);
  assert.match(p, /commentTextToContent/);
  assert.doesNotMatch(p, /dangerouslySetInnerHTML/);
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
