import { describe, expect, it } from "vitest";
import { mergeExamQuestionUpdate, validateExamQuestion, validateStructuredStimulus } from "../../../src/services/exam-content.rules";

const mediaId = "c523f44d-c5ae-4b82-91bf-ccaf165ad567";
const legacy = () => ({
  questionText: "Choose the matching value.", type: "MULTIPLE_CHOICE", order: 1,
  options: [{ optionText: "First", isCorrect: true }, { optionText: "Second", isCorrect: false }],
});

describe("bounded mixed-content question validation", () => {
  it("keeps legacy text MCQ valid with NONE, nullable labels/media and index ordering", () => {
    const result = validateExamQuestion(legacy());
    expect(result).toMatchObject({ stimulusType: "NONE", stimulusMediaId: null, structuredStimulus: null });
    expect(result.options).toEqual([
      { optionText: "First", optionTextEmphasis: null, isCorrect: true, label: null, mediaId: null, order: 0 },
      { optionText: "Second", optionTextEmphasis: null, isCorrect: false, label: null, mediaId: null, order: 1 },
    ]);
  });

  // Synthetic content, preserving every shape actually observed in the supplied manifest.
  const structured = [
    { type: "MATRIX", rows: [[2, "1/3", "?"], ["x", "y", "z"]] },
    { type: "WORD_BANK", items: ["we", "walk", "home"] },
    { type: "NUMBER_SEQUENCE", items: ["1/3", 2, 12, "?"] },
    { type: "ALPHANUMERIC_SEQUENCE", items: ["2A", "4B", "?"] },
    { type: "WORD_SERIES", items: ["up", "down", "?"] },
    { type: "GROUPED_NUMBER_ROWS", groups: [[2, 6, 12], [4, "?", 24]] },
    { type: "LETTER_SEQUENCE", items: ["B", "D", "?"] },
    { type: "LOGICAL_PREMISES", items: ["All Xs are Ys.", "No Zs are Ys."] },
  ];
  it.each(structured)("preserves $type as structured data", stimulus => {
    const result = validateExamQuestion({ ...legacy(), stimulusType: "STRUCTURED", structuredStimulus: stimulus });
    expect(result.structuredStimulus).toEqual(stimulus);
  });

  it.each([
    { type: "UNKNOWN", items: [1] },
    { type: "MATRIX", rows: [[1, 2], [3]] },
    { type: "MATRIX", rows: [] },
    { type: "MATRIX", rows: [[{}]] },
    { type: "MATRIX", rows: [[null]] },
    { type: "WORD_BANK", items: [4] },
    { type: "WORD_BANK", items: [""] },
    { type: "NUMBER_SEQUENCE", items: ["word"] },
    { type: "NUMBER_SEQUENCE", items: [Infinity] },
    { type: "GROUPED_NUMBER_ROWS", groups: [["word"]] },
    { type: "LETTER_SEQUENCE", items: ["AB"] },
    { type: "ALPHANUMERIC_SEQUENCE", items: ["a/b"] },
    { type: "LOGICAL_PREMISES", items: [] },
    { type: "WORD_BANK", items: Array(101).fill("a") },
    { type: "WORD_SERIES", items: ["a"], answerKeyCandidate: "secret" },
    { type: "MATRIX", rows: [["a"]], storageKey: "private/key" },
  ])("rejects malformed/unsupported structured payload %#", value => {
    expect(() => validateStructuredStimulus(value)).toThrow();
  });

  it("supports image stimuli and image-only options without fake text", () => {
    const result = validateExamQuestion({
      ...legacy(), stimulusType: "IMAGE", stimulusMediaId: mediaId,
      options: [
        { label: "F", mediaId, isCorrect: true },
        { label: "K", optionText: null, mediaId, isCorrect: false },
      ],
    });
    expect(result.stimulusMediaId).toBe(mediaId);
    expect(result.options.map(opt => opt.optionText)).toEqual([null, null]);
  });

  it("preserves source labels and explicit order independently of array position", () => {
    const result = validateExamQuestion({ ...legacy(), options: [
      { label: "K", order: 9, optionText: "Last", isCorrect: false },
      { label: "F", order: 2, optionText: "First", isCorrect: true },
    ] });
    expect(result.options.map(opt => [opt.label, opt.order])).toEqual([["F", 2], ["K", 9]]);
  });

  it.each([
    { type: "IMAGE" }, { type: "UNKNOWN" },
    { stimulusType: "MATRIX" }, { stimulusType: null },
    { stimulusType: "NONE", stimulusMediaId: mediaId },
    { stimulusType: "NONE", structuredStimulus: structured[0] },
    { stimulusType: "STRUCTURED" },
    { stimulusType: "STRUCTURED", structuredStimulus: structured[0], stimulusMediaId: mediaId },
    { stimulusType: "IMAGE" },
    { stimulusType: "IMAGE", stimulusMediaId: mediaId, structuredStimulus: structured[0] },
    { stimulusType: "IMAGE", stimulusMediaId: "https://example.com/image.png" },
    { stimulusType: "IMAGE", stimulusMediaId: "assets/q001/stimulus.png" },
    { stimulusType: "IMAGE", stimulusMediaId: "C:\\exam\\image.png" },
    { questionText: " " }, { questionText: "a".repeat(20001) },
    { order: -1 }, { order: 1.1 }, { order: 2147483648 },
    { correctAnswer: "A" }, { options: null },
  ])("rejects invalid question combinations %#", patch => {
    expect(() => validateExamQuestion({ ...legacy(), ...patch })).toThrow();
  });

  it.each([
    { optionText: " " }, { optionText: null },
    { optionText: "Text", mediaId },
    { optionText: null, mediaId: "private/storage/key" },
    { optionText: null, mediaId: "../image.png" },
    { isCorrect: "true" }, { order: -1 }, { order: 0.5 },
    { label: "bad label" }, { label: "a" }, { label: "ABCDEFGHI" },
    { storageKey: "private/key" },
  ])("rejects invalid option content/identity %#", patch => {
    const input = legacy();
    expect(() => validateExamQuestion({ ...input, options: [{ ...input.options[0], ...patch }, input.options[1]] })).toThrow();
  });

  it.each([
    [{ optionText: "a", isCorrect: false }, { optionText: "b", isCorrect: false }],
    [{ optionText: "a", isCorrect: true }, { optionText: "b", isCorrect: true }],
    [{ optionText: "a", isCorrect: true }],
    [],
    [{ optionText: "a", isCorrect: true, label: "F" }, { optionText: "b", isCorrect: false, label: "F" }],
    [{ optionText: "a", isCorrect: true, label: "F" }, { optionText: "b", isCorrect: false }],
    [{ optionText: "a", isCorrect: true, order: 2 }, { optionText: "b", isCorrect: false, order: 2 }],
    [{ id: "same", optionText: "a", isCorrect: true }, { id: "same", optionText: "b", isCorrect: false }],
  ])("rejects ambiguous MCQ/label/order/identity state %#", (...options) => {
    expect(() => validateExamQuestion({ ...legacy(), options })).toThrow();
  });

  it("accepts ESSAY without MCQ semantics and rejects essay options", () => {
    expect(validateExamQuestion({ questionText: "Explain.", type: "ESSAY" }).options).toEqual([]);
    expect(() => validateExamQuestion({ ...legacy(), type: "ESSAY" })).toThrow();
  });

  it("validates partial updates against existing type, stimulus and correct options", () => {
    const current = validateExamQuestion(legacy());
    expect(mergeExamQuestionUpdate(current, { questionText: "Updated." }).options).toEqual(current.options);
    expect(() => mergeExamQuestionUpdate(current, { type: "ESSAY" })).toThrow();
    expect(() => mergeExamQuestionUpdate(current, { stimulusType: "STRUCTURED" })).toThrow();
    expect(() => mergeExamQuestionUpdate(current, { correctAnswer: "A" })).toThrow();
  });
});
