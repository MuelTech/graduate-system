import { validateStructuredStimulus } from "./exam-content.rules";
import { createHash } from "crypto";
import type { PreparedExamPackage } from "../interfaces/exam-content-import.interfaces";
import {
  validateTextEmphasis,
  structuredItemText,
  validateStructuredStimulusEmphasis,
  type StructuredStimulusEmphasis,
  type TextEmphasisSpan,
} from "../shared/text-emphasis";

export const OLSAT_MANIFEST_SHA256 =
  "2cd14cd6578eafe14536db36833a07a085e7d7e091ed2f6d2a934f79b6f30c95";
export const textSha256 = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
type Target =
  | { field: "questionText" }
  | { field: "optionText"; label: string; order: number }
  | { field: "structuredItem"; index: number };
interface Annotation {
  sourceQuestionNumber: number;
  target: Target;
  textSha256: string;
  spans: TextEmphasisSpan[] | null;
}
export interface VerifiedEmphasisSidecar {
  schemaVersion: 2;
  packageKey: "olsat";
  manifestSha256: string;
  indexConvention: "UTF16_CODE_UNITS";
  verification: { status: "VERIFIED"; verifiedBy: string; verifiedAt: string };
  annotations: Annotation[];
}
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new Error("Malformed emphasis annotations.");
  return value as Record<string, unknown>;
}
export function parseEmphasisSidecar(
  value: unknown,
  source: PreparedExamPackage,
  manifestSha256: string,
): VerifiedEmphasisSidecar {
  const data = object(value, [
    "schemaVersion",
    "packageKey",
    "manifestSha256",
    "indexConvention",
    "verification",
    "annotations",
  ]);
  if (
    data.schemaVersion !== 2 ||
    data.packageKey !== "olsat" ||
    data.manifestSha256 !== manifestSha256 ||
    data.indexConvention !== "UTF16_CODE_UNITS"
  )
    throw new Error("Emphasis source identity mismatch.");
  const verified = object(data.verification, [
    "status",
    "verifiedBy",
    "verifiedAt",
  ]);
  if (
    verified.status !== "VERIFIED" ||
    typeof verified.verifiedBy !== "string" ||
    !verified.verifiedBy.trim() ||
    verified.verifiedBy.length > 191 ||
    typeof verified.verifiedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
      verified.verifiedAt,
    ) ||
    !Number.isFinite(Date.parse(verified.verifiedAt))
  )
    throw new Error("Owner/source verification is required.");
  if (
    !Array.isArray(data.annotations) ||
    !data.annotations.length ||
    data.annotations.length > 2048
  )
    throw new Error("Invalid annotation count.");
  const seen = new Set<string>();
  const annotations = data.annotations.map((raw): Annotation => {
    const annotation = object(raw, [
      "sourceQuestionNumber",
      "target",
      "textSha256",
      "spans",
    ]);
    if (!Number.isInteger(annotation.sourceQuestionNumber))
      throw new Error("Invalid source question number.");
    const question = source.questions.find(
      (q) => q.sourceQuestionNumber === annotation.sourceQuestionNumber,
    );
    if (!question) throw new Error("Unknown source question number.");
    const target = object(annotation.target, [
      "field",
      "label",
      "order",
      "index",
    ]);
    let identity: Target;
    let text: string | null;
    if (target.field === "questionText" && Object.keys(target).length === 1) {
      identity = { field: "questionText" };
      text = question.input.questionText;
    } else if (
      target.field === "optionText" &&
      Object.keys(target).length === 3 &&
      typeof target.label === "string" &&
      typeof target.order === "number" &&
      Number.isInteger(target.order)
    ) {
      const option = question.input.options.find(
        (o) => o.label === target.label && o.order === target.order,
      );
      if (!option || option.optionText === null)
        throw new Error("Unknown or image-only source option.");
      identity = {
        field: "optionText",
        label: target.label,
        order: target.order,
      };
      text = option.optionText;
    } else if (
      target.field === "structuredItem" &&
      Object.keys(target).length === 2 &&
      typeof target.index === "number" &&
      question.input.stimulusType === "STRUCTURED"
    ) {
      identity = { field: "structuredItem", index: target.index };
      text = structuredItemText(
        question.input.structuredStimulus,
        target.index,
      );
    } else throw new Error("Invalid emphasis target.");
    if (text === null || annotation.textSha256 !== textSha256(text))
      throw new Error("Annotation text hash mismatch.");
    if (!Array.isArray(annotation.spans))
      throw new Error(
        "Explicit annotation spans are required; use [] to clear.",
      );
    const spans = validateTextEmphasis(text, annotation.spans);
    const key = `${question.sourceQuestionNumber}:${JSON.stringify(identity)}`;
    if (seen.has(key)) throw new Error("Duplicate annotation target.");
    seen.add(key);
    return {
      sourceQuestionNumber: question.sourceQuestionNumber,
      target: identity,
      textSha256: annotation.textSha256 as string,
      spans,
    };
  });
  return {
    schemaVersion: 2,
    packageKey: "olsat",
    manifestSha256,
    indexConvention: "UTF16_CODE_UNITS",
    verification: verified as VerifiedEmphasisSidecar["verification"],
    annotations,
  };
}

// Narrow transactional adapter: no question/option create/delete or answer operations.
export interface EmphasisTransaction {
  examContentImport: {
    findUnique(
      args: unknown,
    ): Promise<{ fingerprint: string; questionCount: number } | null>;
  };
  examQuestion: {
    findMany(args: unknown): Promise<EmphasisQuestion[]>;
    update(args: unknown): Promise<unknown>;
  };
  examOption: { update(args: unknown): Promise<unknown> };
}
interface EmphasisQuestion {
  id: string;
  sourceQuestionNumber: number | null;
  questionText: string;
  questionTextEmphasis: unknown;
  stimulusType: string;
  structuredStimulus: unknown;
  structuredStimulusEmphasis: unknown;
  options: {
    id: string;
    label: string | null;
    order: number;
    optionText: string | null;
    optionTextEmphasis: unknown;
  }[];
}
/** Resolve EVERY target before any write; the caller owns one Serializable transaction. */
export async function reconcileEmphasis(
  tx: EmphasisTransaction,
  sidecar: VerifiedEmphasisSidecar,
  source: PreparedExamPackage,
  apply: boolean,
) {
  const marker = await tx.examContentImport.findUnique({
    where: { id: "olsat" },
    select: { fingerprint: true, questionCount: true },
  });
  if (
    !marker ||
    marker.fingerprint !== source.fingerprint ||
    marker.questionCount !== source.questions.length
  )
    throw new Error("Imported bank source identity mismatch.");
  const rows = await tx.examQuestion.findMany({
    where: { sourceImportId: "olsat" },
    select: {
      id: true,
      sourceQuestionNumber: true,
      questionText: true,
      questionTextEmphasis: true,
      stimulusType: true,
      structuredStimulus: true,
      structuredStimulusEmphasis: true,
      options: {
        select: {
          id: true,
          label: true,
          order: true,
          optionText: true,
          optionTextEmphasis: true,
        },
      },
    },
  });
  if (
    rows.length !== source.questions.length ||
    new Set(rows.map((r) => r.sourceQuestionNumber)).size !== rows.length ||
    rows.some(
      (r) =>
        !source.questions.some(
          (q) => q.sourceQuestionNumber === r.sourceQuestionNumber,
        ),
    )
  )
    throw new Error("Imported bank source identities are incomplete.");
  const changes: {
    model: "examQuestion" | "examOption";
    id: string;
    field:
      | "questionTextEmphasis"
      | "optionTextEmphasis"
      | "structuredStimulusEmphasis";
    spans: TextEmphasisSpan[] | StructuredStimulusEmphasis;
  }[] = [];
  const structured = new Map<
    string,
    {
      current: StructuredStimulusEmphasis;
      next: StructuredStimulusEmphasis;
      stimulus: unknown;
    }
  >();
  for (const annotation of sidecar.annotations) {
    const row = rows.find(
      (r) => r.sourceQuestionNumber === annotation.sourceQuestionNumber,
    )!;
    let target: { id: string; text: string | null; emphasis: unknown };
    const identity = annotation.target;
    if (identity.field === "structuredItem") {
      const canonical = source.questions.find(
        (q) => q.sourceQuestionNumber === annotation.sourceQuestionNumber,
      )!.input;
      if (
        row.stimulusType !== "STRUCTURED" ||
        JSON.stringify(validateStructuredStimulus(row.structuredStimulus)) !==
          JSON.stringify(
            validateStructuredStimulus(canonical.structuredStimulus),
          )
      )
        throw new Error("Imported structured content mismatch.");
      const text = structuredItemText(row.structuredStimulus, identity.index);
      if (textSha256(text) !== annotation.textSha256)
        throw new Error("Imported item hash mismatch.");
      let group = structured.get(row.id);
      if (!group) {
        const current = validateStructuredStimulusEmphasis(
          row.structuredStimulus,
          row.structuredStimulusEmphasis,
        );
        group = { current, next: current, stimulus: row.structuredStimulus };
        structured.set(row.id, group);
      }
      group.next = validateStructuredStimulusEmphasis(group.stimulus, [
        ...(group.next ?? []).filter((entry) => entry.index !== identity.index),
        ...(annotation.spans
          ? [{ index: identity.index, spans: annotation.spans }]
          : []),
      ]);
      continue;
    }
    if (identity.field === "questionText")
      target = {
        id: row.id,
        text: row.questionText,
        emphasis: row.questionTextEmphasis,
      };
    else {
      const matches = row.options.filter(
        (o) => o.label === identity.label && o.order === identity.order,
      );
      if (matches.length !== 1)
        throw new Error("Imported option identity mismatch.");
      const option = matches[0];
      target = {
        id: option.id,
        text: option.optionText,
        emphasis: option.optionTextEmphasis,
      };
    }
    if (
      target.text === null ||
      textSha256(target.text) !== annotation.textSha256
    )
      throw new Error("Imported text hash mismatch.");
    const current = validateTextEmphasis(target.text, target.emphasis);
    if (JSON.stringify(current) !== JSON.stringify(annotation.spans))
      changes.push({
        model:
          identity.field === "questionText" ? "examQuestion" : "examOption",
        id: target.id,
        field:
          identity.field === "questionText"
            ? "questionTextEmphasis"
            : "optionTextEmphasis",
        spans: annotation.spans,
      });
  }
  for (const [id, group] of structured)
    if (JSON.stringify(group.current) !== JSON.stringify(group.next))
      changes.push({
        model: "examQuestion",
        id,
        field: "structuredStimulusEmphasis",
        spans: group.next,
      });
  if (apply)
    for (const change of changes)
      await tx[change.model].update({
        where: { id: change.id },
        data: { [change.field]: change.spans },
      });
  return {
    status: apply
      ? changes.length
        ? "APPLIED"
        : "ALREADY_APPLIED"
      : "PREFLIGHT_OK",
    annotationsValidated: sidecar.annotations.length,
    fieldsChanged: apply ? changes.length : 0,
    fieldsWouldChange: changes.length,
  };
}
