import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../../../frontend/src/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, "aria-label": label }: any) =>
    createElement(
      "button",
      { type: "button", onClick, disabled, "aria-label": label },
      children,
    ),
}));
vi.mock(
  "../../../../frontend/src/components/exam-content/exam-media-image",
  () => ({ ExamMediaImage: () => null }),
);
import { StructuredStimulusEditor } from "../../../../frontend/src/components/exam-content/structured-stimulus-editor";
import { StructuredStimulusRenderer } from "../../../../frontend/src/components/exam-content/stimulus-renderer";
import { SemanticTextEditor } from "../../../../frontend/src/components/exam-content/semantic-text-editor";
import {
  STRUCTURED_LAYOUTS,
  structuredLayout,
  newStructuredLayoutDraft,
  structuredDraft,
  buildStructuredStimulus,
  readStructuredStimulus,
  questionDraft,
  buildQuestionPayload,
  buildQuestionSavePayload,
  type StructuredDraft,
} from "../../../../frontend/src/lib/exam-content";
import {
  editEmphasizedText,
  type StructuredStimulusEmphasis,
} from "../../../../frontend/src/lib/text-emphasis";
import { validateExamQuestion } from "../../../src/services/exam-content.rules";
const frontendRequire = createRequire(path.resolve("../frontend/package.json"));
const { createElement } = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");

const legacy = [
  [
    {
      type: "MATRIX",
      rows: [
        [1, "01", "1/2"],
        [-2.5, "?", 1e25],
      ],
    },
    "GRID",
  ],
  [
    {
      type: "GROUPED_NUMBER_ROWS",
      groups: [
        [1, "2", "1/2"],
        [4, "?", 6],
      ],
    },
    "GRID",
  ],
  [{ type: "WORD_BANK", items: ["red", "blue"] }, "INLINE"],
  [{ type: "NUMBER_SEQUENCE", items: [1, "2", "1/2", "?"] }, "INLINE"],
  [{ type: "ALPHANUMERIC_SEQUENCE", items: ["2A", "4B", "?"] }, "INLINE"],
  [{ type: "WORD_SERIES", items: ["near", "far", "?"] }, "INLINE"],
  [{ type: "LETTER_SEQUENCE", items: ["A", "C", "?"] }, "INLINE"],
  [
    { type: "LOGICAL_PREMISES", items: ["All Xs are Ys.", "No Zs are Ys."] },
    "NUMBERED",
  ],
] as const;
const bold = { start: 0, end: 3, style: "BOLD" as const };
const marks = [{ index: 0, spans: [bold] }];
const render = (component: unknown, props: unknown) =>
  renderToStaticMarkup(createElement(component, props));
const children = (node: any): any[] =>
  Array.isArray(node)
    ? node.flatMap(children)
    : node && typeof node === "object" && node.props
      ? [node, ...children(node.props.children)]
      : [];
const text = (node: any): string =>
  Array.isArray(node)
    ? node.map(text).join("")
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : node?.props
        ? text(node.props.children)
        : "";

// Controlled component callbacks, not a duplicate implementation of the editor actions.
function editor(
  initial: StructuredDraft,
  emphasis: StructuredStimulusEmphasis = null,
) {
  let value = initial;
  let currentMarks = emphasis;
  const tree = () =>
    StructuredStimulusEditor({
      value,
      emphasis: currentMarks,
      onChange: (next, nextMarks) => {
        value = next;
        currentMarks = nextMarks;
      },
    });
  const nodes = () => children(tree());
  return {
    get value() {
      return value;
    },
    get marks() {
      return currentMarks;
    },
    choose(layout: string) {
      nodes()
        .find((n) => n.type === "select")
        .props.onChange({ target: { value: layout } });
    },
    click(label: string, index = 0) {
      const button = nodes().filter(
        (n) =>
          typeof n.props.onClick === "function" &&
          text(n.props.children) === label,
      )[index];
      expect(button).toBeDefined();
      expect(button.props.disabled).not.toBe(true);
      button.props.onClick();
    },
    removeItem(index: number) {
      nodes()
        .find((n) => n.props["aria-label"] === `Remove item ${index + 1}`)
        .props.onClick();
    },
    editCell(row: number, column: number, next: string) {
      nodes()
        .find(
          (n) => n.props["aria-label"] === `Row ${row + 1} cell ${column + 1}`,
        )
        .props.onChange({ target: { value: next } });
    },
    editItem(index: number, next: string) {
      const semantic = nodes().filter((n) => n.type === SemanticTextEditor)[
        index
      ];
      if (semantic) {
        const result = editEmphasizedText(
          semantic.props.text,
          next,
          semantic.props.emphasis,
        );
        semantic.props.onChange(result.text, result.emphasis);
      } else
        nodes()
          .find((n) => n.props["aria-label"] === `Item ${index + 1}`)
          .props.onChange({ target: { value: next } });
    },
    disabled(label: string) {
      return nodes().find(
        (n) =>
          typeof n.props.onClick === "function" &&
          text(n.props.children) === label,
      )?.props.disabled;
    },
  };
}

function question(
  stimulus: any,
  emphasis: StructuredStimulusEmphasis = null,
): any {
  return {
    id: "q",
    questionText: "Synthetic instruction",
    questionTextEmphasis: [bold],
    type: "MULTIPLE_CHOICE",
    order: 1,
    stimulusType: "STRUCTURED",
    stimulusMediaId: null,
    structuredStimulus: stimulus,
    structuredStimulusEmphasis: emphasis,
    options: ["One", "Two"].map((optionText, index) => ({
      id: `o${index}`,
      questionId: "q",
      optionText,
      optionTextEmphasis: index ? null : [bold],
      label: index ? "B" : "A",
      order: index,
      mediaId: null,
      isCorrect: !index,
    })),
  };
}

describe("three layout families with legacy round-trip compatibility", () => {
  it("exposes exactly three layout labels and uses existing broad representations", () => {
    expect(STRUCTURED_LAYOUTS.map((f) => f.label)).toEqual([
      "Grid / Table",
      "Inline Items",
      "Numbered List",
    ]);
    expect(newStructuredLayoutDraft("GRID").type).toBe("MATRIX");
    expect(newStructuredLayoutDraft("INLINE").type).toBe("WORD_SERIES");
    expect(newStructuredLayoutDraft("NUMBERED").type).toBe("LOGICAL_PREMISES");
    expect(() => newStructuredLayoutDraft("__proto__" as never)).toThrow(
      "Choose a supported structured layout.",
    );
  });
  it.each(legacy)("maps and preserves %j as %s", (stimulus, layout) => {
    const draft = structuredDraft(stimulus)!;
    expect(structuredLayout(draft.type)).toBe(layout);
    const actor = editor(draft);
    actor.choose(layout);
    expect(actor.value).toBe(draft);
    expect(buildStructuredStimulus(actor.value)).toStrictEqual(stimulus);
    expect(JSON.stringify(buildStructuredStimulus(actor.value))).toBe(
      JSON.stringify(stimulus),
    );
    const payload = buildQuestionPayload(questionDraft(question(stimulus)));
    expect(validateExamQuestion(payload)).toStrictEqual(payload);
    const html = render(StructuredStimulusRenderer, {
      stimulus: payload.structuredStimulus,
    });
    expect(html).not.toContain('role="alert"');
    if (layout === "GRID") expect(html).toContain("<table");
    else
      expect(html).toContain(
        layout === "NUMBERED" ? "list-decimal" : "flex list-none",
      );
  });
  it.each(legacy)(
    "renders one family selector and no primitive selectors for %j",
    (stimulus) => {
      const html = render(StructuredStimulusEditor, {
        value: structuredDraft(stimulus),
        onChange: () => {},
      });
      expect(html.match(/<select/g)).toHaveLength(1);
      expect(html).toContain("Structured layout");
      for (const family of STRUCTURED_LAYOUTS)
        expect(html).toContain(family.label);
      expect(html).not.toMatch(
        /value="(?:text|number)"|value type|>Number<|>Text<|>Matrix<|>Word series<|>Grouped number rows</,
      );
      if ("rows" in stimulus || "groups" in stimulus)
        expect(html).toContain("Add row");
    },
  );
  it("preserves all 29 real structured source payloads, including numeric primitives", () => {
    const manifest = JSON.parse(
      fs.readFileSync("exam-content/olsat/manifest.json", "utf8"),
    );
    const stimuli = manifest.questions
      .map((q: any) => q.stimulus)
      .filter((s: any) => readStructuredStimulus(s));
    expect(stimuli).toHaveLength(29);
    for (const stimulus of stimuli) {
      expect(buildStructuredStimulus(structuredDraft(stimulus))).toStrictEqual(
        stimulus,
      );
      expect(
        JSON.stringify(buildStructuredStimulus(structuredDraft(stimulus))),
      ).toBe(JSON.stringify(stimulus));
    }
  });
  it("preserves untouched numeric values when another grid cell changes", () => {
    const actor = editor(structuredDraft(legacy[0][0])!);
    actor.editCell(0, 1, "free text");
    expect(buildStructuredStimulus(actor.value)).toEqual({
      type: "MATRIX",
      rows: [
        [1, "free text", "1/2"],
        [-2.5, "?", 1e25],
      ],
    });
    actor.editCell(0, 1, "01");
    expect(buildStructuredStimulus(actor.value)).toStrictEqual(legacy[0][0]);
  });
  it("keeps untouched numeric sequence primitives during an ordinary numeric edit", () => {
    const actor = editor(
      structuredDraft({
        type: "NUMBER_SEQUENCE",
        items: [1, "02", 1e25, "?"],
      })!,
    );
    actor.editItem(0, "3");
    expect(buildStructuredStimulus(actor.value)).toStrictEqual({
      type: "NUMBER_SEQUENCE",
      items: ["3", "02", 1e25, "?"],
    });
    actor.editItem(0, "1");
    expect(buildStructuredStimulus(actor.value)).toStrictEqual({
      type: "NUMBER_SEQUENCE",
      items: [1, "02", 1e25, "?"],
    });
  });
});

describe("actual row/column and ordered-item controls", () => {
  it.each([legacy[0][0], legacy[1][0]])(
    "adds/removes rows and columns without primitive drift in %j",
    (stimulus) => {
      const actor = editor(structuredDraft(stimulus)!);
      actor.click("Add row");
      expect(actor.value.rows).toHaveLength(3);
      expect(actor.value.rows[2].map((c) => c.value)).toEqual(["", "", ""]);
      actor.click("Remove row", 2);
      expect(buildStructuredStimulus(actor.value)).toStrictEqual(stimulus);
      actor.click("Add column");
      expect(actor.value.rows.every((row) => row.length === 4)).toBe(true);
      actor.click("Remove last column");
      expect(buildStructuredStimulus(actor.value)).toStrictEqual(stimulus);
    },
  );
  it.each(legacy.slice(2))(
    "adds/edits/removes inline or numbered items in %j",
    (stimulus) => {
      const draft = structuredDraft(stimulus)!;
      const count = draft.items.length;
      const actor = editor(draft);
      actor.click("Add item");
      expect(actor.value.items).toHaveLength(count + 1);
      actor.editItem(count, "A new text entry");
      const saved = buildStructuredStimulus(actor.value);
      expect("items" in saved && saved.items.at(-1)).toBe("A new text entry");
      expect(
        validateExamQuestion(
          buildQuestionPayload({
            ...questionDraft(question(stimulus)),
            structured: actor.value,
          }),
        ).structuredStimulus,
      ).toEqual(saved);
      actor.removeItem(count);
      expect(buildStructuredStimulus(actor.value)).toStrictEqual(stimulus);
    },
  );
  it("uses numbered list controls and the existing numbered renderer", () => {
    const actor = editor(newStructuredLayoutDraft("NUMBERED"));
    actor.editItem(0, "First premise");
    actor.click("Add item");
    actor.editItem(1, "Second premise");
    const html = render(StructuredStimulusRenderer, {
      stimulus: buildStructuredStimulus(actor.value),
    });
    expect(html).toContain("list-decimal");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("First premise");
    expect(html).toContain("Second premise");
  });
  it("bounds rows/columns and items with disabled controls", () => {
    const one = editor(structuredDraft({ type: "MATRIX", rows: [[1]] })!);
    expect(one.disabled("Remove row")).toBe(true);
    expect(one.disabled("Remove last column")).toBe(true);
    const grid = editor(
      structuredDraft({
        type: "MATRIX",
        rows: Array.from({ length: 30 }, () => Array(30).fill("?")),
      })!,
    );
    expect(grid.disabled("Add row")).toBe(true);
    expect(grid.disabled("Add column")).toBe(true);
    const items = editor(
      structuredDraft({ type: "WORD_SERIES", items: Array(100).fill("item") })!,
    );
    expect(items.disabled("Add item")).toBe(true);
  });
  it.each([legacy[1][0], legacy[3][0], legacy[4][0], legacy[6][0]])(
    "accepts ordinary text edits using a compatible representation in %j",
    (stimulus) => {
      const actor = editor(structuredDraft(stimulus)!);
      if ("groups" in stimulus) actor.editCell(0, 0, "ordinary text");
      else actor.editItem(0, "ordinary text");
      const saved = buildStructuredStimulus(actor.value);
      expect(saved.type).toBe("groups" in stimulus ? "MATRIX" : "WORD_SERIES");
      expect(
        validateExamQuestion(
          buildQuestionPayload({
            ...questionDraft(question(stimulus)),
            structured: actor.value,
          }),
        ).structuredStimulus,
      ).toEqual(saved);
    },
  );
});

describe("emphasis preservation and bounded validation", () => {
  it.each([25, 45])(
    "preserves Q%s and its exact reviewed emphasis on an unchanged save",
    (number) => {
      const manifest = JSON.parse(
        fs.readFileSync("exam-content/olsat/manifest.json", "utf8"),
      );
      const sidecar = JSON.parse(
        fs.readFileSync("exam-content/olsat-emphasis.json", "utf8"),
      );
      const source = manifest.questions.find(
        (q: any) => q.questionNumber === number,
      );
      const annotations = sidecar.annotations.filter(
        (a: any) => a.sourceQuestionNumber === number,
      );
      const structuredMarks = annotations
        .filter((a: any) => a.target.field === "structuredItem")
        .map((a: any) => ({ index: a.target.index, spans: a.spans }));
      const original = {
        ...question(source.stimulus, structuredMarks),
        questionText: source.questionText,
        questionTextEmphasis: annotations.find(
          (a: any) => a.target.field === "questionText",
        ).spans,
      };
      const draft = questionDraft(original);
      const actor = editor(draft.structured!, draft.structuredStimulusEmphasis);
      actor.choose("INLINE");
      const payload = buildQuestionSavePayload(
        {
          ...draft,
          structured: actor.value,
          structuredStimulusEmphasis: actor.marks,
        },
        original,
      );
      expect(payload.structuredStimulus).toStrictEqual(source.stimulus);
      expect(payload.structuredStimulusEmphasis).toStrictEqual(structuredMarks);
      expect(payload.questionTextEmphasis).toStrictEqual(
        original.questionTextEmphasis,
      );
      expect(payload).not.toHaveProperty("options");
      expect(draft.options[0].optionTextEmphasis).toStrictEqual(
        original.options[0].optionTextEmphasis,
      );
    },
  );
  it("keeps marks on unchanged items, clears edited items, and clears index/layout changes", () => {
    const stimulus = { type: "WORD_SERIES", items: ["one", "two"] };
    const actor = editor(structuredDraft(stimulus)!, [
      ...marks,
      { index: 1, spans: [bold] },
    ]);
    actor.editItem(0, "one");
    expect(actor.marks).toHaveLength(2);
    actor.editItem(0, "new");
    expect(actor.marks).toEqual([{ index: 1, spans: [bold] }]);
    actor.click("Add item");
    expect(actor.marks).toBeNull();
    const removed = editor(structuredDraft(stimulus)!, marks);
    removed.removeItem(0);
    expect(removed.marks).toBeNull();
    const other = editor(structuredDraft(stimulus)!, marks);
    other.choose("NUMBERED");
    expect(other.value.type).toBe("LOGICAL_PREMISES");
    expect(other.marks).toBeNull();
  });
  it.each([
    { type: "UNKNOWN", items: ["a"] },
    { type: "MATRIX", rows: [[1], [2, 3]] },
    { type: "GROUPED_NUMBER_ROWS", groups: [["word"]] },
    { type: "NUMBER_SEQUENCE", items: ["word"] },
    { type: "WORD_SERIES", items: [1] },
    { type: "WORD_SERIES", items: ["x"], html: true },
  ])("rejects malformed stored payloads without adapting them %j", (value) => {
    expect(readStructuredStimulus(value)).toBeNull();
    expect(structuredDraft(value)).toBeNull();
    expect(render(StructuredStimulusRenderer, { stimulus: value })).toContain(
      'role="alert"',
    );
  });
  it("reports visible-family errors and rejects bounds instead of repairing malformed structure", () => {
    expect(() =>
      buildStructuredStimulus({
        ...newStructuredLayoutDraft("GRID"),
        rows: [[{ value: "1" }], [{ value: "2" }, { value: "3" }]],
      }),
    ).toThrow("Rows must have the same number of cells.");
    expect(() =>
      buildStructuredStimulus({
        ...newStructuredLayoutDraft("INLINE"),
        items: [],
      }),
    ).toThrow("Enter at least one item.");
    expect(() =>
      buildStructuredStimulus({
        ...newStructuredLayoutDraft("NUMBERED"),
        items: [],
      }),
    ).toThrow("Enter at least one list item.");
    expect(() =>
      buildStructuredStimulus({
        ...newStructuredLayoutDraft("INLINE"),
        items: Array(101).fill({ value: "x" }),
      }),
    ).toThrow("100");
    expect(() =>
      buildStructuredStimulus({
        ...newStructuredLayoutDraft("GRID"),
        rows: [[{ value: "x".repeat(501) }]],
      }),
    ).toThrow("500");
  });
});
