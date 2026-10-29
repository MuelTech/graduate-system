import { describe, expect, it } from "vitest";
import { validateTextEmphasis } from "../../../src/shared/text-emphasis";
import {
  canonicalTextareaOffset,
  clearTextSelection,
  editEmphasizedText,
  markTextSelection,
  semanticTextSegments,
  validateTextEmphasis as frontendValidate,
} from "../../../../frontend/src/lib/text-emphasis";
import {
  mergeExamQuestionUpdate,
  validateExamQuestion,
} from "../../../src/services/exam-content.rules";
const bold = { start: 0, end: 3, style: "BOLD" as const };
const underline = { start: 2, end: 6, style: "UNDERLINE" as const };
const question = () => ({
  questionText: "NOT all",
  type: "MULTIPLE_CHOICE",
  options: [
    { id: "one", optionText: "First", isCorrect: true },
    { id: "two", optionText: "Other", isCorrect: false },
  ],
});
describe("bounded UTF-16 emphasis contract", () => {
  it("accepts bold, underline and different-style overlap in deterministic order", () =>
    expect(validateTextEmphasis("NOT all", [underline, bold])).toEqual([
      bold,
      underline,
    ]));
  it.each([undefined, null, []])("accepts legacy/no emphasis %s", (value) =>
    expect(validateTextEmphasis("plain", value)).toBeNull(),
  );
  it.each([
    [{ ...bold, start: -1 }],
    [{ ...bold, start: 0.5 }],
    [{ ...bold, end: 1.5 }],
    [{ ...bold, end: 0 }],
    [{ ...bold, start: 3 }],
    [{ ...bold, end: 99 }],
    [{ ...bold, style: "ITALIC" }],
    [bold, bold],
    [bold, { ...bold, start: 1, end: 4 }],
    [{ ...bold, isCorrect: true }],
    {},
    [null],
    ["bold"],
    [{ start: NaN, end: 3, style: "BOLD" }],
    Array.from({ length: 129 }, () => bold),
  ])("rejects malformed/ambiguous marks %#", (value) =>
    expect(() => validateTextEmphasis("NOT all", value)).toThrow(),
  );
  it("rejects splitting a UTF-16 surrogate pair", () => {
    expect(
      validateTextEmphasis("A\uD83D\uDE00Z", [
        { start: 1, end: 3, style: "BOLD" },
      ]),
    ).toHaveLength(1);
    for (const [start, end] of [
      [1, 2],
      [2, 3],
    ])
      expect(() =>
        validateTextEmphasis("A\uD83D\uDE00Z", [{ start, end, style: "BOLD" }]),
      ).toThrow();
  });
  it("rejects image-only option emphasis through the actual API boundary", () => {
    const q = question();
    expect(() =>
      validateExamQuestion({
        ...q,
        options: [
          {
            ...q.options[0],
            optionText: null,
            mediaId: "00000000-0000-4000-8000-000000000001",
            optionTextEmphasis: [bold],
          },
          q.options[1],
        ],
      }),
    ).toThrow();
  });
  it("passes semantic fields through create validation", () => {
    const q = question();
    const result = validateExamQuestion({
      ...q,
      questionTextEmphasis: [bold],
      options: q.options.map((o) => ({ ...o, optionTextEmphasis: [bold] })),
    });
    expect(result.questionTextEmphasis).toEqual([bold]);
    expect(result.options[0].optionTextEmphasis).toEqual([bold]);
  });
  it("clears inherited marks on changed text but preserves untouched option marks", () => {
    const q = validateExamQuestion({
      ...question(),
      questionTextEmphasis: [bold],
      options: question().options.map((o) => ({
        ...o,
        optionTextEmphasis: [bold],
      })),
    });
    const result = mergeExamQuestionUpdate(q, {
      questionText: "ANY all",
      options: q.options.map(({ optionTextEmphasis, ...o }) => ({
        ...o,
        optionText: o.id === "one" ? "Third" : o.optionText,
      })),
    });
    expect(result.questionTextEmphasis).toBeNull();
    expect(result.options[0].optionTextEmphasis).toBeNull();
    expect(result.options[1].optionTextEmphasis).toEqual([bold]);
  });
});
describe("backend/frontend validation parity", () => {
  it("agrees on every bounded UTF-16 range and malformed inputs", () => {
    const text = "A\uD83D\uDE00B\n ";
    const samples: unknown[] = [
      null,
      undefined,
      [],
      {},
      [null],
      [{ start: 0, end: 3, style: "ITALIC" }],
      [bold, bold],
      [bold, underline],
      [{ ...bold, start: -1 }],
    ];
    for (let start = -1; start <= text.length + 1; start++)
      for (let end = -1; end <= text.length + 1; end++)
        for (const style of ["BOLD", "UNDERLINE"])
          samples.push([{ start, end, style }]);
    for (const sample of samples) {
      let a, b;
      try {
        a = validateTextEmphasis(text, sample);
      } catch {
        a = "REJECT";
      }
      try {
        b = frontendValidate(text, sample);
      } catch {
        b = "REJECT";
      }
      expect(b).toEqual(a);
    }
  });
});
describe("selection editing and segmentation", () => {
  it("creates bold and underline from selected ranges", () =>
    expect(
      markTextSelection(
        "NOT all",
        markTextSelection("NOT all", null, 0, 3, "BOLD"),
        2,
        6,
        "UNDERLINE",
      ),
    ).toEqual([bold, underline]));
  it("removes selected formatting and retains unaffected fragments", () => {
    expect(
      clearTextSelection(
        "NOT all",
        [{ start: 0, end: 7, style: "BOLD" }],
        2,
        5,
      ),
    ).toEqual([
      { start: 0, end: 2, style: "BOLD" },
      { start: 5, end: 7, style: "BOLD" },
    ]);
    expect(clearTextSelection("NOT all", [bold], 0, 3)).toBeNull();
  });
  it("clears all marks for insertion/deletion/same-length edits", () => {
    for (const next of ["N all", "XOT all", "NOT all!"])
      expect(editEmphasizedText("NOT all", next, [bold])).toEqual({
        text: next,
        emphasis: null,
        cleared: true,
      });
    expect(editEmphasizedText("NOT all", "NOT all", [bold]).emphasis).toEqual([
      bold,
    ]);
  });
  it("maps textarea-normalized CRLF selection back to unchanged canonical text", () => {
    expect(canonicalTextareaOffset("A\r\nB\rC", 2)).toBe(3);
    expect(canonicalTextareaOffset("A\r\nB\rC", 5)).toBe(6);
    expect(() => canonicalTextareaOffset("A", 2)).toThrow();
  });
  it("preserves text, newlines and whitespace across overlapping styles", () => {
    const text = "NOT all\n\t ";
    const segments = semanticTextSegments(text, [bold, underline]);
    expect(segments.map((s) => s.text).join("")).toBe(text);
    expect(
      segments.slice(0, 3).map((s) => [s.text, s.bold, s.underline]),
    ).toEqual([
      ["NO", true, false],
      ["T", true, true],
      [" al", false, true],
    ]);
  });
  it("falls back to exact plain text for invalid metadata", () => {
    const text = '<script>alert("x")</script>\n';
    expect(semanticTextSegments(text, [{ ...bold, end: 999 }])).toEqual([
      { start: 0, text, bold: false, underline: false },
    ]);
  });
});
