import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "../../../../frontend/src/types";
import { buildQuestionPayload, buildQuestionSavePayload, buildStructuredStimulus, optionLabel, questionDraft, readStructuredStimulus, selectCorrectOption, structuredDraft, STRUCTURED_TYPES } from "../../../../frontend/src/lib/exam-content";
import { validateExamQuestion } from "../../../src/services/exam-content.rules";

const stimulusId = "00000000-0000-4000-8000-000000000001";
const optionId = "00000000-0000-4000-8000-000000000002";
const question = (): AdminQuestion => ({
  id: "q1", questionText: "Synthetic instruction.", type: "MULTIPLE_CHOICE", order: 9,
  stimulusType: "IMAGE", stimulusMediaId: stimulusId, structuredStimulus: null,
  options: [
    { id: "o1", questionId: "q1", label: "F", order: 2, optionText: null, mediaId: optionId, isCorrect: false },
    { id: "o2", questionId: "q1", label: "K", order: 7, optionText: "Synthetic text", mediaId: null, isCorrect: true },
  ],
});

describe("Admin frontend draft → accepted backend contract", () => {
  it("preserves IDs, source labels/order and existing media without fake image text", () => {
    const original = question();
    const payload = buildQuestionPayload(questionDraft(original));
    expect(validateExamQuestion(payload)).toEqual(payload);
    expect(payload.stimulusMediaId).toBe(stimulusId);
    expect(payload.options.map(option => [option.id, option.label, option.order, option.mediaId, option.optionText])).toEqual([["o1", "F", 2, optionId, null], ["o2", "K", 7, null, "Synthetic text"]]);
    expect(payload.options[0]).not.toHaveProperty("questionId");
    expect(payload.options[0]).not.toHaveProperty("key");
  });

  it("omits untouched options from metadata-only updates", () => {
    const original = question();
    const draft = questionDraft(original);
    draft.questionText = "Updated wording.";
    const payload = buildQuestionSavePayload(draft, original);
    expect(payload).not.toHaveProperty("options");
    expect(payload.stimulusMediaId).toBe(stimulusId);
  });

  it("does not rewrite legacy tied option orders during metadata-only edits", () => {
    const original = question();
    original.options.forEach(option => { option.order = 0; option.label = null; });
    const payload = buildQuestionSavePayload(questionDraft(original), original);
    expect(payload).not.toHaveProperty("options");
    expect(original.options.map(option => option.order)).toEqual([0, 0]);
  });

  it("preserves existing IDs/media when editing an option or changing correctness", () => {
    const original = question();
    const draft = questionDraft(original);
    draft.options.reverse();
    draft.options = selectCorrectOption(draft.options, "o1");
    const payload = buildQuestionPayload(draft);
    expect(payload.options.filter(option => option.isCorrect).map(option => option.id)).toEqual(["o1"]);
    expect(payload.options.find(option => option.id === "o1")?.mediaId).toBe(optionId);
    expect(validateExamQuestion(payload).options.map(option => option.label)).toEqual(["F", "K"]);
  });

  it("displays persisted labels and neutral ordinals for legacy null labels", () => {
    expect(optionLabel({ label: "J", order: 0 })).toBe("J");
    expect(optionLabel({ label: null, order: 4 })).toBe("Option 5");
  });

  it("requires uploaded media for image-only options and exactly one correct option", () => {
    const draft = questionDraft(question());
    draft.options[0].mediaId = null;
    expect(() => buildQuestionPayload(draft)).toThrow("Upload an image");
    draft.options[0].mediaId = optionId;
    draft.options.forEach(option => { option.isCorrect = true; });
    expect(() => buildQuestionPayload(draft)).toThrow("exactly one");
  });

  it("clears incompatible stimulus fields explicitly and retains essay no-options semantics", () => {
    const draft = questionDraft(question());
    draft.type = "ESSAY";
    draft.stimulusType = "NONE";
    const payload = buildQuestionPayload(draft);
    expect(payload).toMatchObject({ options: [], stimulusMediaId: null, structuredStimulus: null });
    expect(validateExamQuestion(payload)).toEqual(payload);
  });

  it.each([
    { type: "MATRIX", rows: [[1, "1/2", "12"], ["word", "?", 3]] },
    { type: "GROUPED_NUMBER_ROWS", groups: [[1, 2, 3], [4, "?", 6]] },
    { type: "NUMBER_SEQUENCE", items: [1, "1/4", "?", 8] },
    { type: "ALPHANUMERIC_SEQUENCE", items: ["2A", "4B", "?"] },
    { type: "WORD_BANK", items: ["a", "synthetic", "phrase"] },
    { type: "WORD_SERIES", items: ["near", "far", "?"] },
    { type: "LETTER_SEQUENCE", items: ["A", "C", "?"] },
    { type: "LOGICAL_PREMISES", items: ["All Xs are Ys.", "No Zs are Ys."] },
  ])("round-trips $type through typed editor cells and backend validation", stimulus => {
    const structured = buildStructuredStimulus(structuredDraft(stimulus));
    expect(structured).toEqual(stimulus);
    const draft = questionDraft(question());
    draft.stimulusType = "STRUCTURED";
    draft.structured = structuredDraft(stimulus);
    const payload = buildQuestionPayload(draft);
    expect(payload.stimulusMediaId).toBeNull();
    expect(validateExamQuestion(payload).structuredStimulus).toEqual(stimulus);
  });

  it.each([{ type: "UNKNOWN", items: ["x"] }, { type: "MATRIX", rows: [[1], [2, 3]] }, { type: "WORD_BANK", items: [1] }, { type: "NUMBER_SEQUENCE", items: ["word"] }, { type: "WORD_SERIES", items: ["x"], isCorrect: true }])("fails safely for unknown/malformed structured data %#", stimulus => {
    expect(readStructuredStimulus(stimulus)).toBeNull();
    expect(structuredDraft(stimulus)).toBeNull();
    expect(() => buildStructuredStimulus(structuredDraft(stimulus))).toThrow();
  });

  it("handles exactly the accepted eight structured subtypes", () => {
    expect(STRUCTURED_TYPES).toHaveLength(8);
  });
});
