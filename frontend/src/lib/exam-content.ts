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
export interface CellDraft {
  value: string;
  kind: "text" | "number";
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
  mediaId: string | null;
  isCorrect: boolean;
}
export interface QuestionDraft {
  questionText: string;
  type: ExamQuestionType;
  order: number;
  stimulusType: ExamStimulusType;
  stimulusMediaId: string | null;
  structured: StructuredDraft | null;
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
  kind: typeof value === "number" ? "number" : "text",
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
    rows: [[{ value: "?", kind: "text" }]],
    items: [{ value: "", kind: "text" }],
  };
}
export function buildStructuredStimulus(
  draft: StructuredDraft | null,
): StructuredStimulus {
  if (!draft) return fail("Choose a supported structured form.");
  const parse = (cell: CellDraft): ExamCell => {
    if (cell.kind === "text") return cell.value;
    if (!cell.value.trim() || !Number.isFinite(Number(cell.value)))
      return fail("Enter a finite number for each numeric cell.");
    return Number(cell.value);
  };
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
  return (
    readStructuredStimulus(candidate) ??
    fail(
      "Check the structured items: rows need equal widths, text items cannot be blank, and numeric forms allow numbers, fractions or ?.",
    )
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
      type: "MULTIPLE_CHOICE",
      order,
      stimulusType: "NONE",
      stimulusMediaId: null,
      structured: null,
      options: [newOption(0), newOption(1), newOption(2), newOption(3)],
    };
  return {
    questionText: question.questionText,
    type: question.type,
    order: question.order,
    stimulusType: question.stimulusType,
    stimulusMediaId: question.stimulusMediaId,
    structured: structuredDraft(question.structuredStimulus),
    options: question.options.map((opt) => ({
      key: opt.id,
      id: opt.id,
      label: opt.label,
      order: opt.order,
      optionText: opt.optionText,
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
    type: draft.type,
    order,
    stimulusType: draft.stimulusType,
    stimulusMediaId,
    structuredStimulus,
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
    type: payload.type,
    order: payload.order,
    stimulusType: payload.stimulusType,
    stimulusMediaId: payload.stimulusMediaId,
    structuredStimulus: payload.structuredStimulus,
  };
}
