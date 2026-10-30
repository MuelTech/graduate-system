import { describe, expect, it } from "vitest";
import {
  validateTextEmphasis,
  validateStructuredStimulusEmphasis,
  structuredItemText,
} from "../../../src/shared/text-emphasis";
import {
  validateStructuredStimulusEmphasis as frontendValidate,
  semanticTextSegments,
  markTextSelection,
  clearTextSelection,
  editEmphasizedText,
} from "../../../../frontend/src/lib/text-emphasis";
import {
  mergeExamQuestionUpdate,
  validateExamQuestion,
} from "../../../src/services/exam-content.rules";
import {
  buildQuestionPayload,
  buildQuestionSavePayload,
  questionDraft,
  structuredDraftEmphasisAfterEdit,
  structuredDraft,
} from "../../../../frontend/src/lib/exam-content";
import {
  toAdminQuestion,
  toApplicantQuestion,
} from "../../../src/repositories/exam-content.projection";

const italic = { start: 0, end: 3, style: "ITALIC" as const };
const stimulus = { type: "WORD_SERIES", items: ["alpha", "bravo", "charlie"] };
const marks = [
  { index: 0, spans: [italic] },
  { index: 2, spans: [italic] },
];
const question = () =>
  validateExamQuestion({
    questionText: "Synthetic",
    type: "MULTIPLE_CHOICE",
    stimulusType: "STRUCTURED",
    structuredStimulus: stimulus,
    structuredStimulusEmphasis: marks,
    options: [
      { optionText: "One", isCorrect: true },
      { optionText: "Two", isCorrect: false },
    ],
  });

describe("ITALIC UTF-16 and editing extension", () => {
  it("rejects same-style overlap and duplicates, allows adjacent ITALIC", () => {
    expect(() => validateTextEmphasis("abcdef", [italic, italic])).toThrow();
    expect(() =>
      validateTextEmphasis("abcdef", [italic, { ...italic, start: 2, end: 4 }]),
    ).toThrow();
    expect(
      validateTextEmphasis("abcdef", [italic, { ...italic, start: 3, end: 6 }]),
    ).toHaveLength(2);
  });
  it("accepts triple overlap and segments all three flags deterministically", () => {
    const spans = [
      italic,
      { ...italic, style: "BOLD" },
      { ...italic, style: "UNDERLINE" },
    ];
    expect(validateTextEmphasis("abc", spans)).toHaveLength(3);
    expect(semanticTextSegments("abc", spans)).toEqual([
      { start: 0, text: "abc", bold: true, underline: true, italic: true },
    ]);
    expect(markTextSelection("abc", null, 0, 3, "ITALIC")).toEqual([italic]);
    expect(clearTextSelection("abc", spans, 0, 3)).toBeNull();
    expect(editEmphasizedText("abc", "xyz", [italic])).toMatchObject({
      emphasis: null,
      cleared: true,
    });
  });
  it("protects surrogate boundaries for italic", () => {
    expect(() =>
      validateTextEmphasis("A\uD83D\uDE00Z", [{ ...italic, start: 1, end: 2 }]),
    ).toThrow();
    expect(
      validateTextEmphasis("A\uD83D\uDE00Z", [{ ...italic, start: 1, end: 3 }]),
    ).toHaveLength(1);
  });
});

describe("bounded separate structured emphasis", () => {
  it.each([
    "WORD_SERIES",
    "WORD_BANK",
    "ALPHANUMERIC_SEQUENCE",
    "LETTER_SEQUENCE",
    "LOGICAL_PREMISES",
  ])("supports canonical string items in %s", (type) => {
    expect(
      validateStructuredStimulusEmphasis({ ...stimulus, type }, marks),
    ).toEqual(marks);
  });
  it.each([null, undefined, [], [{ index: 1, spans: [] }]])(
    "normalizes empty metadata %#",
    (value) => {
      expect(validateStructuredStimulusEmphasis(stimulus, value)).toBeNull();
    },
  );
  it.each([
    {},
    [null],
    [{ index: -1, spans: [italic] }],
    [{ index: 0.5, spans: [italic] }],
    [{ index: 3, spans: [italic] }],
    [marks[0], marks[0]],
    [{ ...marks[0], path: "items.0" }],
    [{ index: 0 }],
    [{ index: 0, spans: null }],
    [{ index: 0, spans: [{ ...italic, end: 99 }] }],
    Array.from({ length: 101 }, (_, index) => ({ index, spans: [] })),
  ])("rejects malformed metadata with backend/frontend parity %#", (value) => {
    expect(() => validateStructuredStimulusEmphasis(stimulus, value)).toThrow();
    expect(() => frontendValidate(stimulus, value)).toThrow();
  });
  it.each([
    { type: "MATRIX", rows: [["alpha"]] },
    { type: "GROUPED_NUMBER_ROWS", groups: [[1]] },
    { type: "NUMBER_SEQUENCE", items: ["123"] },
    { type: "IMAGE", items: ["alpha"] },
    { type: "WORD_SERIES", items: ["alpha", 5] },
    null,
  ])("rejects unsupported/non-string structured targets %#", (value) => {
    expect(() => structuredItemText(value, 0)).toThrow();
    expect(() =>
      validateStructuredStimulusEmphasis(value, [marks[0]]),
    ).toThrow();
    expect(() => frontendValidate(value, [marks[0]])).toThrow();
  });
  it("sorts indexes and validates each exact item string with parity", () => {
    expect(
      validateStructuredStimulusEmphasis(stimulus, [...marks].reverse()),
    ).toEqual(marks);
    expect(frontendValidate(stimulus, marks)).toEqual(marks);
    expect(stimulus).toEqual({
      type: "WORD_SERIES",
      items: ["alpha", "bravo", "charlie"],
    });
  });
});

describe("server authoritative structured metadata merge", () => {
  it("preserves omitted metadata on unchanged structured content including key ordering", () => {
    const q = question();
    expect(
      mergeExamQuestionUpdate(q, { questionText: "Edited instruction" })
        .structuredStimulusEmphasis,
    ).toEqual(marks);
    expect(
      mergeExamQuestionUpdate(q, {
        structuredStimulus: { items: stimulus.items, type: stimulus.type },
      }).structuredStimulusEmphasis,
    ).toEqual(marks);
  });
  it("clears inherited metadata on text edits, reorder, remove, add and subtype change", () => {
    for (const next of [
      { ...stimulus, items: ["delta", "bravo", "charlie"] },
      { ...stimulus, items: [...stimulus.items].reverse() },
      { ...stimulus, items: ["bravo", "charlie"] },
      { ...stimulus, items: [...stimulus.items, "delta"] },
      { ...stimulus, type: "WORD_BANK" },
    ])
      expect(
        mergeExamQuestionUpdate(question(), { structuredStimulus: next })
          .structuredStimulusEmphasis,
      ).toBeNull();
  });
  it("clears on leaving STRUCTURED and rejects explicit marks on unsupported final content", () => {
    expect(
      mergeExamQuestionUpdate(question(), {
        stimulusType: "NONE",
        structuredStimulus: null,
      }).structuredStimulusEmphasis,
    ).toBeNull();
    expect(() =>
      mergeExamQuestionUpdate(question(), {
        stimulusType: "NONE",
        structuredStimulus: null,
        structuredStimulusEmphasis: marks,
      }),
    ).toThrow();
    expect(() =>
      mergeExamQuestionUpdate(question(), {
        structuredStimulus: { ...stimulus, items: ["a"] },
        structuredStimulusEmphasis: marks,
      }),
    ).toThrow();
  });
  it("validates explicit replacements against final content, including explicit clear", () => {
    expect(
      mergeExamQuestionUpdate(question(), {
        structuredStimulus: { ...stimulus, items: ["delta"] },
        structuredStimulusEmphasis: [marks[0]],
      }).structuredStimulusEmphasis,
    ).toEqual([marks[0]]);
    expect(
      mergeExamQuestionUpdate(question(), { structuredStimulusEmphasis: [] })
        .structuredStimulusEmphasis,
    ).toBeNull();
  });
});

describe("Admin draft and safe API structured contracts", () => {
  const row = () => ({
    ...question(),
    id: "q",
    options: question().options.map((o, i) => ({
      ...o,
      id: `o${i}`,
      questionId: "q",
    })),
  });
  it("projects separate metadata for Admin/Applicant without correctness leakage", () => {
    const safe = toApplicantQuestion(row() as never);
    expect(safe.structuredStimulusEmphasis).toEqual(marks);
    expect(safe.structuredStimulus).toEqual(stimulus);
    expect(JSON.stringify(safe)).not.toMatch(
      /isCorrect|correctAnswer|sourceImportId/,
    );
    expect(toAdminQuestion(row() as never).options[0].isCorrect).toBe(true);
    expect(() =>
      toApplicantQuestion({
        ...row(),
        structuredStimulusEmphasis: [{ ...marks[0], isCorrect: true }],
      } as never),
    ).toThrow();
  });
  it("round trips separate draft marks and omits unchanged options", () => {
    const original = toAdminQuestion(row() as never);
    const draft = questionDraft(original);
    expect(buildQuestionPayload(draft).structuredStimulusEmphasis).toEqual(
      marks,
    );
    expect(buildQuestionPayload(draft).structuredStimulus).toEqual(stimulus);
    expect(buildQuestionSavePayload(draft, original)).not.toHaveProperty(
      "options",
    );
    draft.stimulusType = "NONE";
    draft.structuredStimulusEmphasis = null;
    expect(buildQuestionPayload(draft).structuredStimulusEmphasis).toBeNull();
  });
  it("retains unchanged item marks, clears edited item and index-changing operations", () => {
    const previous = structuredDraft(stimulus)!;
    const next = structuredClone(previous);
    next.items[0].value = "delta";
    expect(structuredDraftEmphasisAfterEdit(previous, next, marks)).toEqual([
      marks[1],
    ]);
    expect(structuredDraftEmphasisAfterEdit(previous, previous, marks)).toEqual(
      marks,
    );
    expect(
      structuredDraftEmphasisAfterEdit(
        previous,
        { ...previous, items: previous.items.slice(1) },
        marks,
      ),
    ).toBeNull();
    expect(
      structuredDraftEmphasisAfterEdit(
        previous,
        { ...previous, items: [...previous.items, previous.items[0]] },
        marks,
      ),
    ).toBeNull();
    expect(
      structuredDraftEmphasisAfterEdit(
        previous,
        { ...previous, type: "WORD_BANK" },
        marks,
      ),
    ).toBeNull();
    expect(
      structuredDraftEmphasisAfterEdit(
        previous,
        { ...previous, items: [...previous.items].reverse() },
        marks,
      ),
    ).toBeNull();
  });
});
