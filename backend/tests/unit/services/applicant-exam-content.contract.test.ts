import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";
import type { ExamOption, ExamQuestion } from "../../../../frontend/src/types";
import { applicantOptionViews, withApplicantAnswer } from "../../../../frontend/src/lib/applicant-exam-content";
import { readStructuredStimulus } from "../../../../frontend/src/lib/exam-content";

const mediaId = "00000000-0000-4000-8000-000000000001";
const labels = ["F", "G", "H", "J", "K"];
function question(): ExamQuestion {
  return {
    id: "synthetic-q1", questionText: "Choose a synthetic answer.", type: "MULTIPLE_CHOICE", order: 1,
    stimulusType: "IMAGE", stimulusMediaId: mediaId, structuredStimulus: null,
    options: labels.map((label, order) => ({
      id: `option-${label}`, questionId: "synthetic-q1", label, order,
      optionText: order === 0 ? "Synthetic text choice" : null, mediaId: order === 0 ? null : mediaId,
    })),
  };
}

describe("Applicant mixed-content presentation/selection contract", () => {
  it("keeps persisted F/G/H/J/K labels after defensive sorting", () => {
    const options = question().options.reverse();
    const views = applicantOptionViews(options, undefined, vi.fn());
    expect(views.map(option => option.displayLabel)).toEqual(labels);
    expect(views.map(option => option.id)).toEqual(labels.map(label => `option-${label}`));
    expect(views.map(option => option.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses the accepted neutral fallback for null labels", () => {
    const option: ExamOption = { ...question().options[0], label: null, order: 4 };
    expect(applicantOptionViews([option], undefined, vi.fn())[0].displayLabel).toBe("Option 5");
  });

  it("sorts legacy ties by stable ID without mutating the original payload", () => {
    const options = Object.freeze([
      Object.freeze({ ...question().options[1], id: "b", order: 0 }),
      Object.freeze({ ...question().options[0], id: "a", order: 0 }),
    ]);
    const views = applicantOptionViews(options, "b", vi.fn());
    expect(views.map(option => option.id)).toEqual(["a", "b"]);
    expect(views.map(option => option.selected)).toEqual([false, true]);
    expect(options.map(option => option.id)).toEqual(["b", "a"]);
  });

  it("binds a visual choice to its option ID, never its label/order/text/media ID", () => {
    const onSelect = vi.fn();
    const option = applicantOptionViews(question().options, undefined, onSelect).find(option => option.id === "option-J")!;
    expect(option.optionText).toBeNull();
    expect(option.mediaId).toBe(mediaId);
    option.select();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("option-J");
    expect(onSelect).not.toHaveBeenCalledWith(mediaId);
    expect(onSelect).not.toHaveBeenCalledWith("J");
    expect(onSelect).not.toHaveBeenCalledWith(3);
  });

  it("keeps image/text selections in the existing page map across away/back navigation", () => {
    const before = Object.freeze({});
    let answers: Record<string, string> = before;
    const q1 = question();
    const chooseQ1 = (id: string) => { answers = withApplicantAnswer(answers, q1.id, id); };
    applicantOptionViews(q1.options, answers[q1.id], chooseQ1).find(option => option.id === "option-J")!.select();
    const imageSelection = answers;
    const q2 = { ...q1, id: "synthetic-q2", options: q1.options.map(option => ({ ...option, questionId: "synthetic-q2", id: `q2-${option.id}` })) };
    applicantOptionViews(q2.options, answers[q2.id], id => { answers = withApplicantAnswer(answers, q2.id, id); })[0].select();
    const returned = applicantOptionViews([...q1.options].reverse(), answers[q1.id], chooseQ1);
    expect(returned.filter(option => option.selected).map(option => option.id)).toEqual(["option-J"]);
    expect(answers).toEqual({ "synthetic-q1": "option-J", "synthetic-q2": "q2-option-F" });
    expect(imageSelection).toEqual({ "synthetic-q1": "option-J" });
    expect(before).toEqual({});
  });

  it("preserves both text and image-only option content without fake text", () => {
    const views = applicantOptionViews(question().options, undefined, vi.fn());
    expect(views[0]).toMatchObject({ optionText: "Synthetic text choice", mediaId: null });
    expect(views[1]).toMatchObject({ optionText: null, mediaId });
  });

  it("keeps Applicant fixtures and views free of correctness/internal metadata", () => {
    const fixture = question();
    expect(JSON.stringify(fixture)).not.toMatch(/isCorrect|correctAnswer|storageKey|provider/);
    const unexpected = Object.assign({}, fixture.options[0], { isCorrect: true, storageKey: "private/key", provider: "local" });
    const clean = applicantOptionViews([unexpected], undefined, vi.fn())[0];
    expect(Object.keys(clean).sort()).toEqual(["id", "questionId", "label", "order", "optionText", "mediaId", "displayLabel", "selected", "select"].sort());
    expect(clean.selected).toBe(false);
    expect(JSON.stringify(clean)).not.toMatch(/isCorrect|private\/key|provider/);
  });

  it.each([
    { type: "MATRIX", rows: [[1, "1/2"], [2, "?"]] },
    { type: "GROUPED_NUMBER_ROWS", groups: [[1, 2, 3], [4, "?", 6]] },
    { type: "NUMBER_SEQUENCE", items: [1, "1/4", "?", 8] },
    { type: "ALPHANUMERIC_SEQUENCE", items: ["2A", "4B", "?"] },
    { type: "WORD_SERIES", items: ["near", "far", "?"] },
    { type: "LETTER_SEQUENCE", items: ["A", "C", "?"] },
    { type: "WORD_BANK", items: ["a", "synthetic", "phrase"] },
    { type: "LOGICAL_PREMISES", items: ["All Xs are Ys.", "No Zs are Ys."] },
  ])("passes $type unchanged to the accepted shared renderer contract", structuredStimulus => {
    const q = { ...question(), stimulusType: "STRUCTURED", stimulusMediaId: null, structuredStimulus };
    expect(readStructuredStimulus(q.structuredStimulus)).toEqual(structuredStimulus);
    expect(applicantOptionViews(q.options, undefined, vi.fn()).map(option => option.id)).toEqual(labels.map(label => `option-${label}`));
  });

  it("retains NONE/IMAGE semantics and bounded malformed structured fallback", () => {
    const q = question();
    expect(q).toMatchObject({ stimulusType: "IMAGE", stimulusMediaId: mediaId, structuredStimulus: null });
    const plain = { ...q, stimulusType: "NONE", stimulusMediaId: null, structuredStimulus: null };
    expect(plain.stimulusMediaId).toBeNull();
    expect(readStructuredStimulus({ type: "UNKNOWN", items: ["secret"] })).toBeNull();
    expect(readStructuredStimulus({ type: "MATRIX", rows: [[1], [2, 3]] })).toBeNull();
  });

  it("uses the existing private renderers, native ID-valued radios and no Admin fields", () => {
    const renderer = readFileSync("../frontend/src/components/exam-content/applicant-question-renderer.tsx", "utf8");
    expect(renderer).toContain("<StimulusRenderer");
    expect(renderer).toContain("<OptionContentRenderer");
    expect(renderer).toContain('type="radio"');
    expect(renderer).toContain("value={option.id}");
    expect(renderer).toContain("checked={option.selected}");
    expect(renderer).toContain("onChange={option.select}");
    expect(renderer).toContain("aria-labelledby");
    expect(renderer).toContain("Selected");
    expect(renderer).not.toMatch(/isCorrect|AdminQuestion|AdminOption|correctAnswer|storageKey|exam-content\/olsat|fromCharCode/);
    const optionRenderer = readFileSync("../frontend/src/components/exam-content/option-content-renderer.tsx", "utf8");
    const stimulusRenderer = readFileSync("../frontend/src/components/exam-content/stimulus-renderer.tsx", "utf8");
    expect(optionRenderer + stimulusRenderer).not.toContain("isCorrect");
  });
});
