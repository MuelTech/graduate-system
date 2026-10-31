import {
  validateTextEmphasis,
  validateStructuredStimulusEmphasis,
  type StructuredStimulusEmphasis,
  type TextEmphasisSpan,
} from "./text-emphasis";
import type {
  AdminQuestion,
  ExamCell,
  ExamQuestionType,
  ExamStimulusType,
  StructuredStimulus,
} from "../types";

export const STRUCTURED_TYPES = [
  "MATRIX",
  "WORD_BANK",
  "NUMBER_SEQUENCE",
  "ALPHANUMERIC_SEQUENCE",
  "WORD_SERIES",
  "GROUPED_NUMBER_ROWS",
  "LETTER_SEQUENCE",
  "LOGICAL_PREMISES",
] as const;
export type StructuredType = (typeof STRUCTURED_TYPES)[number];
export const STRUCTURED_LABELS: Record<StructuredType, string> = {
  MATRIX: "Matrix",
  WORD_BANK: "Word bank",
  NUMBER_SEQUENCE: "Number sequence",
  ALPHANUMERIC_SEQUENCE: "Alphanumeric sequence",
  WORD_SERIES: "Word series",
  GROUPED_NUMBER_ROWS: "Grouped number rows",
  LETTER_SEQUENCE: "Letter sequence",
  LOGICAL_PREMISES: "Logical premises",
};
export const STRUCTURED_LAYOUTS = [
  { value: "GRID", label: "Grid / Table" },
  { value: "ITEMS", label: "Items" },
] as const;
export type StructuredLayout = (typeof STRUCTURED_LAYOUTS)[number]["value"];
const STRUCTURED_LAYOUT_BY_TYPE: Record<StructuredType, StructuredLayout> = {
  MATRIX: "GRID",
  GROUPED_NUMBER_ROWS: "GRID",
  WORD_BANK: "ITEMS",
  NUMBER_SEQUENCE: "ITEMS",
  ALPHANUMERIC_SEQUENCE: "ITEMS",
  WORD_SERIES: "ITEMS",
  LETTER_SEQUENCE: "ITEMS",
  LOGICAL_PREMISES: "ITEMS",
};
const LAYOUT_DEFAULT_TYPE: Record<StructuredLayout, StructuredType> = {
  GRID: "MATRIX",
  ITEMS: "WORD_SERIES",
};
export const structuredLayout = (type: StructuredType): StructuredLayout =>
  STRUCTURED_LAYOUT_BY_TYPE[type];
export interface CellDraft {
  value: string;
  /** Hidden compatibility only: an untouched value retains its JSON primitive. */
  originalValue?: ExamCell;
}
export interface StructuredDraft {
  type: StructuredType;
  rows: CellDraft[][];
  items: CellDraft[];
}
export interface OptionDraft {
  key: string;
  id?: string;
  label: string | null;
  order: number;
  optionText: string | null;
  optionTextEmphasis?: TextEmphasisSpan[] | null;
  mediaId: string | null;
  isCorrect: boolean;
}
export interface QuestionDraft {
  questionText: string;
  questionTextEmphasis?: TextEmphasisSpan[] | null;
  type: ExamQuestionType;
  order: number;
  stimulusType: ExamStimulusType;
  stimulusMediaId: string | null;
  structured: StructuredDraft | null;
  structuredStimulusEmphasis?: StructuredStimulusEmphasis;
  options: OptionDraft[];
}
let nextKey = 0;
export const isExamMediaId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
function fail(message: string): never {
  throw new Error(message);
}
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(`${name} must contain 1–${max} characters.`);
  return value;
}
function number(value: unknown, name: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 2147483647
  )
    fail(`${name} must be a non-negative whole number.`);
  return value;
}

/** Runtime guard shared by preview and editor; unknown/malformed content fails closed. */
export function readStructuredStimulus(
  value: unknown,
): StructuredStimulus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!STRUCTURED_TYPES.includes(data.type as StructuredType)) return null;
  const type = data.type as StructuredType;
  const field =
    type === "MATRIX"
      ? "rows"
      : type === "GROUPED_NUMBER_ROWS"
        ? "groups"
        : "items";
  if (Object.keys(data).some((key) => key !== "type" && key !== field))
    return null;
  const cell = (value: unknown, numeric: boolean): boolean =>
    typeof value === "number"
      ? Number.isFinite(value)
      : typeof value === "string" &&
        !!value.trim() &&
        value.length <= 500 &&
        (!numeric ||
          value === "?" ||
          /^-?\d+(?:\.\d+)?(?:\/[1-9]\d*)?$/.test(value));
  if (field !== "items") {
    const rows = data[field];
    if (
      !Array.isArray(rows) ||
      rows.length < 1 ||
      rows.length > 30 ||
      !Array.isArray(rows[0]) ||
      rows[0].length < 1 ||
      rows[0].length > 30 ||
      rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== rows[0].length ||
          row.some((value) => !cell(value, type === "GROUPED_NUMBER_ROWS")),
      )
    )
      return null;
  } else {
    const items = data.items;
    if (
      !Array.isArray(items) ||
      !items.length ||
      items.length > 100 ||
      items.some((value) =>
        type === "NUMBER_SEQUENCE"
          ? !cell(value, true)
          : typeof value !== "string" || !cell(value, false),
      )
    )
      return null;
    if (
      type === "LETTER_SEQUENCE" &&
      items.some((value) => !/^(?:[A-Za-z]|\?)$/.test(value))
    )
      return null;
    if (
      type === "ALPHANUMERIC_SEQUENCE" &&
      items.some((value) => !/^(?:[A-Za-z0-9]+|\?)$/.test(value))
    )
      return null;
  }
  return value as StructuredStimulus;
}

const toDraftCell = (value: ExamCell): CellDraft => ({
  value: String(value),
  originalValue: value,
});
export function structuredDraft(value: unknown): StructuredDraft | null {
  const stimulus = readStructuredStimulus(value);
  if (!stimulus) return null;
  return {
    type: stimulus.type,
    rows:
      "rows" in stimulus
        ? stimulus.rows.map((row) => row.map(toDraftCell))
        : "groups" in stimulus
          ? stimulus.groups.map((row) => row.map(toDraftCell))
          : [],
    items: "items" in stimulus ? stimulus.items.map(toDraftCell) : [],
  };
}
export function newStructuredDraft(type: StructuredType): StructuredDraft {
  return {
    type,
    rows: [[{ value: "?" }]],
    items: [{ value: "" }],
  };
}
export function newStructuredLayoutDraft(
  layout: StructuredLayout,
): StructuredDraft {
  if (!STRUCTURED_LAYOUTS.some((family) => family.value === layout))
    return fail("Choose a supported structured layout.");
  const type = LAYOUT_DEFAULT_TYPE[layout];
  return newStructuredDraft(type);
}
export function buildStructuredStimulus(
  draft: StructuredDraft | null,
): StructuredStimulus {
  if (!draft || !STRUCTURED_TYPES.includes(draft.type))
    return fail("Choose a supported structured layout.");
  const layout = structuredLayout(draft.type);
  const itemName = layout === "GRID" ? "cell" : "item";
  const parse = (cell: CellDraft): ExamCell => {
    if (!cell || typeof cell.value !== "string" || !cell.value.trim())
      return fail(`Enter a value for each ${itemName}.`);
    if (cell.value.length > 500)
      return fail(`Each ${itemName} must contain at most 500 characters.`);
    if (cell.originalValue !== undefined) {
      if (
        typeof cell.originalValue !== "string" &&
        !(
          typeof cell.originalValue === "number" &&
          Number.isFinite(cell.originalValue)
        )
      )
        return fail("Invalid saved cell value.");
      if (cell.value === String(cell.originalValue)) return cell.originalValue;
    }
    return cell.value;
  };
  if (layout === "GRID") {
    if (!Array.isArray(draft.rows) || !draft.rows.length)
      return fail("Enter at least one row.");
    if (
      draft.rows.length > 30 ||
      draft.rows.some((row) => !Array.isArray(row) || row.length > 30)
    )
      return fail("Use at most 30 rows and 30 columns.");
    if (!draft.rows[0].length)
      return fail("Enter at least one cell in each row.");
    if (draft.rows.some((row) => row.length !== draft.rows[0].length))
      return fail("Rows must have the same number of cells.");
  } else {
    if (!Array.isArray(draft.items) || !draft.items.length)
      return fail("Enter at least one item.");
    if (draft.items.length > 100) return fail("Use at most 100 items.");
  }
  const field =
    draft.type === "MATRIX"
      ? "rows"
      : draft.type === "GROUPED_NUMBER_ROWS"
        ? "groups"
        : "items";
  const candidate = {
    type: draft.type,
    [field]:
      field === "items"
        ? draft.items.map(parse)
        : draft.rows.map((row) => row.map(parse)),
  };
  const legacy = readStructuredStimulus(candidate);
  if (legacy) return legacy;
  // Actual edits may outgrow a legacy value grammar. Keep the visible layout
  // using its broad existing representation; untouched valid payloads return above.
  const compatible =
    layout === "GRID"
      ? { type: "MATRIX", rows: draft.rows.map((row) => row.map(parse)) }
      : {
          type: LAYOUT_DEFAULT_TYPE[layout],
          items: draft.items.map((cell) => String(parse(cell))),
        };
  return (
    readStructuredStimulus(compatible) ??
    fail("Check the values in this structured layout.")
  );
}
export function newOption(order: number): OptionDraft {
  return {
    key: `new-option-${++nextKey}`,
    label: null,
    order,
    optionText: "",
    mediaId: null,
    isCorrect: false,
  };
}
export function questionDraft(
  question: AdminQuestion | null,
  order = 1,
): QuestionDraft {
  if (!question)
    return {
      questionText: "",
      questionTextEmphasis: null,
      type: "MULTIPLE_CHOICE",
      order,
      stimulusType: "NONE",
      stimulusMediaId: null,
      structured: null,
      structuredStimulusEmphasis: null,
      options: [newOption(0), newOption(1), newOption(2), newOption(3)],
    };
  return {
    questionText: question.questionText,
    questionTextEmphasis: question.questionTextEmphasis ?? null,
    type: question.type,
    order: question.order,
    stimulusType: question.stimulusType,
    stimulusMediaId: question.stimulusMediaId,
    structured: structuredDraft(question.structuredStimulus),
    structuredStimulusEmphasis: validateStructuredStimulusEmphasis(
      question.structuredStimulus,
      question.structuredStimulusEmphasis,
    ),
    options: question.options.map((opt) => ({
      key: opt.id,
      id: opt.id,
      label: opt.label,
      order: opt.order,
      optionText: opt.optionText,
      optionTextEmphasis: opt.optionTextEmphasis ?? null,
      mediaId: opt.mediaId,
      isCorrect: opt.isCorrect,
    })),
  };
}
export function optionLabel(option: {
  label: string | null;
  order: number;
}): string {
  return option.label ?? `Option ${option.order + 1}`;
}
export function selectCorrectOption(
  options: OptionDraft[],
  key: string,
): OptionDraft[] {
  return options.map((option) => ({
    ...option,
    isCorrect: option.key === key,
  }));
}

export function buildQuestionPayload(draft: QuestionDraft) {
  if (draft.type !== "MULTIPLE_CHOICE" && draft.type !== "ESSAY")
    fail("Unsupported response type.");
  if (!["NONE", "IMAGE", "STRUCTURED"].includes(draft.stimulusType))
    fail("Unsupported stimulus category.");
  const questionText = text(draft.questionText, "Question text", 20000);
  const order = number(draft.order, "Question order");
  const structuredStimulus =
    draft.stimulusType === "STRUCTURED"
      ? buildStructuredStimulus(draft.structured)
      : null;
  const stimulusMediaId =
    draft.stimulusType === "IMAGE" ? draft.stimulusMediaId : null;
  if (draft.stimulusType === "IMAGE" && !isExamMediaId(stimulusMediaId))
    fail("Upload a stimulus image before saving.");
  const options =
    draft.type === "ESSAY"
      ? []
      : draft.options.map((opt) => {
          if (opt.optionText === null) {
            if (!isExamMediaId(opt.mediaId))
              fail("Upload an image for each image option before saving.");
          } else {
            if (opt.mediaId !== null)
              fail("Each option must contain either text or an image.");
            text(opt.optionText, "Option text", 10000);
          }
          if (opt.label !== null && !/^[A-Z0-9]{1,8}$/.test(opt.label))
            fail("Labels must contain 1–8 uppercase letters or digits.");
          return {
            ...(opt.id ? { id: opt.id } : {}),
            label: opt.label,
            order: number(opt.order, "Option order"),
            optionText: opt.optionText,
            optionTextEmphasis: validateTextEmphasis(
              opt.optionText,
              opt.optionTextEmphasis,
            ),
            mediaId: opt.mediaId,
            isCorrect: opt.isCorrect,
          };
        });
  if (
    draft.type === "MULTIPLE_CHOICE" &&
    (options.length < 2 ||
      options.length > 26 ||
      options.filter((opt) => opt.isCorrect).length !== 1)
  )
    fail("Multiple choice needs 2–26 options and exactly one correct answer.");
  const labels = options.flatMap((opt) =>
    opt.label === null ? [] : [opt.label],
  );
  if (labels.length && labels.length !== options.length)
    fail("Enter a label for every option, or leave every label blank.");
  if (
    new Set(labels).size !== labels.length ||
    new Set(options.map((opt) => opt.order)).size !== options.length
  )
    fail("Option labels and orders must be unique.");
  return {
    questionText,
    questionTextEmphasis: validateTextEmphasis(
      questionText,
      draft.questionTextEmphasis,
    ),
    type: draft.type,
    order,
    stimulusType: draft.stimulusType,
    stimulusMediaId,
    structuredStimulus,
    structuredStimulusEmphasis: validateStructuredStimulusEmphasis(
      structuredStimulus,
      draft.structuredStimulusEmphasis,
    ),
    options,
  };
}

/** Keep untouched options out of updates, including legacy tied order values. */
export function buildQuestionSavePayload(
  draft: QuestionDraft,
  original: AdminQuestion | null,
) {
  const untouched =
    original?.type === "MULTIPLE_CHOICE" &&
    draft.type === original.type &&
    draft.options.length === original.options.length &&
    draft.options.every((option, index) => {
      const old = original.options[index];
      return (
        option.id === old.id &&
        option.label === old.label &&
        option.order === old.order &&
        option.optionText === old.optionText &&
        JSON.stringify(option.optionTextEmphasis ?? null) ===
          JSON.stringify(old.optionTextEmphasis ?? null) &&
        option.mediaId === old.mediaId &&
        option.isCorrect === old.isCorrect
      );
    });
  if (!untouched) return buildQuestionPayload(draft);
  const tied =
    new Set(draft.options.map((option) => option.order)).size !==
    draft.options.length;
  const payload = buildQuestionPayload({
    ...draft,
    options: draft.options.map((option, index) => ({
      ...option,
      order: tied ? index : option.order,
    })),
  });
  return {
    questionText: payload.questionText,
    questionTextEmphasis: payload.questionTextEmphasis,
    type: payload.type,
    order: payload.order,
    stimulusType: payload.stimulusType,
    stimulusMediaId: payload.stimulusMediaId,
    structuredStimulus: payload.structuredStimulus,
    structuredStimulusEmphasis: payload.structuredStimulusEmphasis,
  };
}

/** Index-changing operations clear all marks; text edits clear only the changed item. */
export function structuredDraftEmphasisAfterEdit(
  previous: StructuredDraft | null,
  next: StructuredDraft,
  emphasis: StructuredStimulusEmphasis | undefined,
): StructuredStimulusEmphasis {
  if (
    !previous ||
    previous.type !== next.type ||
    previous.items.length !== next.items.length ||
    next.type === "MATRIX" ||
    next.type === "GROUPED_NUMBER_ROWS" ||
    next.type === "NUMBER_SEQUENCE"
  )
    return null;
  const entries = (emphasis ?? []).filter((entry) => {
    const before = previous.items[entry.index];
    const after = next.items[entry.index];
    return before && after && before.value === after.value;
  });
  return entries.length ? entries : null;
}
