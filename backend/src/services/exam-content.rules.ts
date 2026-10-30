import { validateTextEmphasis, validateStructuredStimulusEmphasis } from "../shared/text-emphasis";
import type { ExamQuestionInput, ExamOptionInput, StructuredStimulus, ExamCell } from "../interfaces/exam-content.interfaces";
import { AppError } from "../utils/AppError";

export function validatedEmphasis(text: string | null, value: unknown) {
  try { return validateTextEmphasis(text, value); }
  catch (error) { return invalid(error instanceof Error ? error.message : "Invalid emphasis metadata."); }
}

export function validatedStructuredEmphasis(stimulus: unknown, value: unknown) {
  try { return validateStructuredStimulusEmphasis(stimulus, value); }
  catch (error) { return invalid(error instanceof Error ? error.message : "Invalid structured emphasis."); }
}

function invalid(message: string): never { throw new AppError(message, 400); }

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: string[], name: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid(`${name} contains unsupported fields.`);
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) invalid(`${name} must be non-empty text of at most ${max} characters.`);
  return value;
}

function order(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2147483647) invalid(`${name} must be a non-negative 32-bit integer.`);
  return value;
}

export function examMediaId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid("Media references must be opaque UUIDs, never paths, URLs or storage keys.");
  }
  return value;
}

function list(value: unknown, name: string, max = 100): unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) invalid(`${name} must contain 1 to ${max} entries.`);
  return value;
}

function cell(value: unknown, numeric: boolean): ExamCell {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const result = text(value, "Structured cell", 500);
  // The manifest contains numeric values, fraction strings and literal '?' gaps.
  if (numeric && result !== "?" && !/^-?\d+(?:\.\d+)?(?:\/[1-9]\d*)?$/.test(result)) invalid("Expected a numeric cell, fraction or '?'.");
  return result;
}

export function validateStructuredStimulus(value: unknown): StructuredStimulus {
  const data = object(value, "structuredStimulus");
  switch (data.type) {
    case "MATRIX":
    case "GROUPED_NUMBER_ROWS": {
      const field = data.type === "MATRIX" ? "rows" : "groups";
      keys(data, ["type", field], "structuredStimulus");
      const rows = list(data[field], field, 30).map(row =>
        list(row, "row", 30).map(value => cell(value, data.type === "GROUPED_NUMBER_ROWS")),
      );
      if (rows.some(row => row.length !== rows[0].length)) invalid("Structured rows must have equal lengths.");
      return data.type === "MATRIX" ? { type: "MATRIX", rows } : { type: "GROUPED_NUMBER_ROWS", groups: rows };
    }
    case "NUMBER_SEQUENCE":
      keys(data, ["type", "items"], "structuredStimulus");
      return { type: data.type, items: list(data.items, "items").map(value => cell(value, true)) };
    case "WORD_BANK":
    case "ALPHANUMERIC_SEQUENCE":
    case "WORD_SERIES":
    case "LETTER_SEQUENCE":
    case "LOGICAL_PREMISES": {
      keys(data, ["type", "items"], "structuredStimulus");
      const items = list(data.items, "items").map(value => text(value, "Structured item", 500));
      if (data.type === "LETTER_SEQUENCE" && items.some(item => !/^(?:[A-Za-z]|\?)$/.test(item))) invalid("LETTER_SEQUENCE requires individual letters or '?'.");
      if (data.type === "ALPHANUMERIC_SEQUENCE" && items.some(item => !/^(?:[A-Za-z0-9]+|\?)$/.test(item))) invalid("ALPHANUMERIC_SEQUENCE requires alphanumeric tokens or '?'.");
      return { type: data.type, items };
    }
    default: return invalid("Unsupported structured stimulus type.");
  }
}

function option(value: unknown, index: number): ExamOptionInput {
  const data = object(value, "option");
  keys(data, ["id", "optionText", "optionTextEmphasis", "label", "order", "mediaId", "isCorrect"], "option");
  const optionText = data.optionText == null ? null : text(data.optionText, "optionText", 10000);
  const mediaId = examMediaId(data.mediaId);
  if ((optionText === null) === (mediaId === null)) invalid("An option requires either text or an image media ID.");
  const label = data.label == null ? null : text(data.label, "label", 8);
  if (label !== null && !/^[A-Z0-9]{1,8}$/.test(label)) invalid("Option labels must contain uppercase letters/digits.");
  if (typeof data.isCorrect !== "boolean") invalid("isCorrect must be boolean.");
  const id = data.id === undefined ? undefined : text(data.id, "option id", 191);
  return { ...(id === undefined ? {} : { id }), optionText, optionTextEmphasis: validatedEmphasis(optionText, data.optionTextEmphasis), mediaId, label, order: order(data.order === undefined ? index : data.order, "option order"), isCorrect: data.isCorrect };
}

const QUESTION_FIELDS = ["questionText", "questionTextEmphasis", "type", "order", "stimulusType", "stimulusMediaId", "structuredStimulus", "structuredStimulusEmphasis", "options"];

/** Validate the effective whole question, including after a partial Admin update. */
export function validateExamQuestion(value: unknown): ExamQuestionInput {
  const data = object(value, "question");
  keys(data, QUESTION_FIELDS, "question");
  const questionText = text(data.questionText, "questionText", 20000);
  if (data.type !== "MULTIPLE_CHOICE" && data.type !== "ESSAY") invalid("Unsupported question type.");
  const stimulusType = data.stimulusType === undefined ? "NONE" : data.stimulusType;
  if (stimulusType !== "NONE" && stimulusType !== "IMAGE" && stimulusType !== "STRUCTURED") invalid("Unsupported stimulus category.");
  const stimulusMediaId = examMediaId(data.stimulusMediaId);
  const structuredStimulus = data.structuredStimulus == null ? null : validateStructuredStimulus(data.structuredStimulus);
  if (stimulusType === "NONE" && (stimulusMediaId || structuredStimulus)) invalid("NONE cannot carry stimulus content.");
  if (stimulusType === "IMAGE" && (!stimulusMediaId || structuredStimulus)) invalid("IMAGE requires only a stimulus media ID.");
  if (stimulusType === "STRUCTURED" && (!structuredStimulus || stimulusMediaId)) invalid("STRUCTURED requires only a structured payload.");
  if (data.options !== undefined && !Array.isArray(data.options)) invalid("options must be an array.");
  const sourceOptions = data.options === undefined ? [] : data.options as unknown[];
  if (sourceOptions.length > 26) invalid("At most 26 options are supported.");
  const options = sourceOptions.map(option).sort((a, b) => a.order - b.order);
  if (data.type === "ESSAY" && options.length) invalid("ESSAY cannot carry options or correct-answer state.");
  if (data.type === "MULTIPLE_CHOICE" && (options.length < 2 || options.filter(opt => opt.isCorrect).length !== 1)) invalid("MCQ requires at least two options and exactly one correct option.");
  const labels = options.map(opt => opt.label).filter(label => label !== null);
  if (labels.length && labels.length !== options.length) invalid("Supply labels for all options or omit all labels for legacy text clients.");
  if (new Set(labels).size !== labels.length) invalid("Option labels must be unique.");
  if (new Set(options.map(opt => opt.order)).size !== options.length) invalid("Option orders must be unique.");
  const ids = options.flatMap(opt => opt.id === undefined ? [] : [opt.id]);
  if (new Set(ids).size !== ids.length) invalid("Option IDs must be unique.");
  return { questionText, questionTextEmphasis: validatedEmphasis(questionText, data.questionTextEmphasis), type: data.type, order: order(data.order === undefined ? 0 : data.order, "question order"), stimulusType, stimulusMediaId, structuredStimulus, structuredStimulusEmphasis: validatedStructuredEmphasis(stimulusType === "STRUCTURED" ? structuredStimulus : null, data.structuredStimulusEmphasis), options };
}

export function mergeExamQuestionUpdate(current: ExamQuestionInput, value: unknown): ExamQuestionInput {
  const patch = object(value, "question update");
  keys(patch, QUESTION_FIELDS, "question update");
  const merged: Record<string, unknown> = { ...current, ...patch };
  if (patch.questionText !== undefined && patch.questionText !== current.questionText && !("questionTextEmphasis" in patch)) merged.questionTextEmphasis = null;
  if (!("structuredStimulusEmphasis" in patch) && (merged.stimulusType !== "STRUCTURED" ||
      JSON.stringify(merged.structuredStimulus == null ? null : validateStructuredStimulus(merged.structuredStimulus)) !==
      JSON.stringify(current.structuredStimulus == null ? null : validateStructuredStimulus(current.structuredStimulus))))
    merged.structuredStimulusEmphasis = null;
  if (Array.isArray(patch.options)) merged.options = patch.options.map(value => {
    const incoming = object(value, "option");
    const old = current.options.find(opt => opt.id !== undefined && opt.id === incoming.id);
    if (!old) return incoming;
    const changed = incoming.optionText !== old.optionText;
    return { ...incoming, optionTextEmphasis: "optionTextEmphasis" in incoming ? incoming.optionTextEmphasis : changed ? null : old.optionTextEmphasis };
  });
  return validateExamQuestion(merged);
}
