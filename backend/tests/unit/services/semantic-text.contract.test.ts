import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SemanticText } from "../../../../frontend/src/components/exam-content/semantic-text";
import {
  buildQuestionPayload,
  buildQuestionSavePayload,
  questionDraft,
} from "../../../../frontend/src/lib/exam-content";
import { applicantOptionViews } from "../../../../frontend/src/lib/applicant-exam-content";
import {
  toAdminQuestion,
  toApplicantQuestion,
} from "../../../src/repositories/exam-content.projection";
const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");
const bold = { start: 0, end: 3, style: "BOLD" as const };
const row = () => ({
  id: "q",
  questionText: "NOT all",
  questionTextEmphasis: [bold],
  type: "MULTIPLE_CHOICE" as const,
  order: 1,
  stimulusType: "NONE" as const,
  stimulusMediaId: null,
  structuredStimulus: null,
  options: [
    {
      id: "o1",
      questionId: "q",
      optionText: "First",
      optionTextEmphasis: [bold],
      label: "F",
      order: 0,
      mediaId: null,
      isCorrect: true,
    },
    {
      id: "o2",
      questionId: "q",
      optionText: "Other",
      optionTextEmphasis: null,
      label: "K",
      order: 1,
      mediaId: null,
      isCorrect: false,
    },
  ],
});
describe("real React semantic text rendering", () => {
  const render = (text: string, emphasis: unknown = null) =>
    renderToStaticMarkup(createElement(SemanticText, { text, emphasis }));
  it("renders no marks as exact escaped text", () =>
    expect(render("plain")).toContain(">plain</span>"));
  it("renders controlled bold and underline nodes", () => {
    expect(render("NOT all", [bold])).toContain(
      '<strong class="font-bold">NOT</strong>',
    );
    expect(render("NOT all", [{ ...bold, style: "UNDERLINE" }])).toContain(
      "<u>NOT</u>",
    );
  });
  it("renders combined/overlapping styles including beginning and end boundaries", () => {
    const html = render("NOT all", [
      bold,
      { start: 2, end: 7, style: "UNDERLINE" },
    ]);
    expect(html).toContain('<strong class="font-bold"><u>T</u></strong>');
    expect(html).toContain("<u> all</u>");
  });
  it("preserves whitespace/newlines and escapes apparent HTML", () => {
    const html = render("<img src=x onerror=alert(1)>\n\t  ");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;\n\t  ");
    expect(html).not.toContain("<img");
    expect(html).toContain("whitespace-pre-wrap");
  });
  it("renders invalid metadata as safely escaped plain text", () =>
    expect(render("NOT all", [{ ...bold, end: 99 }])).not.toContain("<strong"));
});
describe("emphasis across Admin and Applicant contracts", () => {
  it("projects safe marks; Admin alone receives correctness", () => {
    const source = row();
    const applicant = toApplicantQuestion(source);
    const admin = toAdminQuestion(source);
    expect(applicant.questionTextEmphasis).toEqual([bold]);
    expect(applicant.options[0].optionTextEmphasis).toEqual([bold]);
    expect(JSON.stringify(applicant)).not.toMatch(
      /isCorrect|correctAnswer|storage|answerKey/,
    );
    expect(admin.options[0].isCorrect).toBe(true);
    expect(
      applicantOptionViews(applicant.options, undefined, () => {})[0]
        .optionTextEmphasis,
    ).toEqual([bold]);
  });
  it("projects legacy/null marks safely", () => {
    const source = row();
    source.questionTextEmphasis = null as never;
    source.options[0].optionTextEmphasis = null as never;
    expect(toApplicantQuestion(source).questionTextEmphasis).toBeNull();
    expect(
      toApplicantQuestion(source).options[0].optionTextEmphasis,
    ).toBeNull();
  });
  it("rejects untrusted fields nested in semantic marks", () => {
    const source = row();
    source.questionTextEmphasis = [{ ...bold, isCorrect: true }] as never;
    expect(() => toApplicantQuestion(source)).toThrow();
  });
  it("preserves option identity and omits options on question-emphasis-only edits", () => {
    const source = toAdminQuestion(row());
    const draft = questionDraft(source);
    draft.questionTextEmphasis = [{ start: 4, end: 7, style: "UNDERLINE" }];
    expect(buildQuestionSavePayload(draft, source)).not.toHaveProperty(
      "options",
    );
    draft.options[0].optionTextEmphasis = [
      { start: 1, end: 4, style: "UNDERLINE" },
    ];
    const payload = buildQuestionPayload(draft);
    expect(payload.options.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(payload.options[0].optionTextEmphasis).toEqual([
      { start: 1, end: 4, style: "UNDERLINE" },
    ]);
  });
  it("rejects stale text emphasis on image conversion; accepts explicit clearing", () => {
    const draft = questionDraft(toAdminQuestion(row()));
    draft.options[0].optionText = null;
    draft.options[0].mediaId = "00000000-0000-4000-8000-000000000001";
    expect(() => buildQuestionPayload(draft)).toThrow();
    draft.options[0].optionTextEmphasis = null;
    expect(
      buildQuestionPayload(draft).options[0].optionTextEmphasis,
    ).toBeNull();
  });
  it("wires selection controls and every accepted surface to the shared renderer", () => {
    const read = (file: string) =>
      fs.readFileSync(path.resolve("../frontend/src", file), "utf8");
    const editor = read("components/exam-content/semantic-text-editor.tsx");
    expect(editor).toContain("field.selectionStart");
    expect(editor).toContain("field.selectionEnd");
    expect(editor).toContain("editEmphasizedText");
    expect(editor).toContain('role="status"');
    for (const file of [
      "components/exam-content/applicant-question-renderer.tsx",
      "components/exam-content/admin-question-editor.tsx",
      "app/(portal)/admin/exam/questions/page.tsx",
      "app/(portal)/applicant/exam/page.tsx",
    ])
      expect(read(file)).toContain("SemanticText");
    for (const file of [
      "components/exam-content/semantic-text.tsx",
      "components/exam-content/semantic-text-editor.tsx",
    ])
      expect(read(file)).not.toContain("dangerouslySetInnerHTML");
  });
});
