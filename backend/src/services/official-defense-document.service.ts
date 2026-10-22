/**
 * FORM-INT-1: official defense document orchestration.
 *
 * Maps the EXACT finalized evaluator official record (existing
 * `OfficialDefenseRecordService` authority) into the accepted TEMPLATE-1 render
 * input and returns PDF bytes. This layer owns data mapping, evidence validation,
 * server-side asset resolution, and renderer invocation only. It never draws the
 * form, queries unrelated domain models, persists generated documents, or
 * determines academic state.
 */
import { AppError } from "../utils/AppError";
import {
  INSTITUTIONAL_MATRIX_V2,
} from "./oral-evaluation.institutional.rules";
import {
  OfficialDefenseRecordService,
  type OfficialCriteriaDto,
} from "./official-defense-record.service";
import { loadOfficialFormLogos } from "./official-form-assets";
import { formatOfficialFormDate } from "./official-form-display";
import { renderOralExamCriteria } from "../documents/official-defense/oral-exam-criteria/oral-exam-criteria.renderer";
import type {
  OralExamCriteriaRenderInput,
  OralExamCriterionValue,
} from "../documents/official-defense/oral-exam-criteria/oral-exam-criteria.types";
import { renderOralExamSummary } from "../documents/official-defense/oral-exam-summary/oral-exam-summary.renderer";
import type {
  OralExamSummaryExaminerRow,
  OralExamSummaryRenderInput,
} from "../documents/official-defense/oral-exam-summary/oral-exam-summary.types";
import type { InstitutionalLogos } from "../documents/official-defense/shared/institutional-header";
import type { PdfImageInput } from "../documents/official-defense/shared/pdf-layout";
import { LEGACY_POINTS_V1 } from "./oral-evaluation.institutional.rules";
import type { OfficialSummaryDocumentSource } from "./official-defense-record.service";

/** Conservative scoped limit for one evaluator signature image. */
export const MAX_SIGNATURE_BYTES = 1024 * 1024;

const SIGNATURE_DATA_URL = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GROUP_I_FIELDS = [
  "timelinessRelevance",
  "organization",
  "depthComprehensiveness",
  "relevanceConclusions",
  "evidenceOriginalThinking",
] as const;
const GROUP_II_FIELDS = [
  "presentation",
  "masterySubject",
  "communicationSkill",
  "attitude",
] as const;
const MATRIX_VALUES = [1, 1.25, 1.5, 1.75, 2, 2.5] as const;
const MATRIX_PRINTED: readonly OralExamCriterionValue[] = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.50",
];
export interface OfficialDefenseDocumentActor {
  readonly userId: string;
  readonly role: string;
}

type RecordsReader = Pick<
  OfficialDefenseRecordService,
  "getOfficialCriteria" | "getOfficialSummaryDocumentSource"
>;

export interface OfficialDefenseDocumentDeps {
  readonly records?: RecordsReader;
  readonly loadLogos?: () => Promise<InstitutionalLogos>;
  readonly render?: (input: OralExamCriteriaRenderInput) => Promise<Uint8Array>;
  readonly renderSummary?: (input: OralExamSummaryRenderInput) => Promise<Uint8Array>;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function printedCriterion(
  criteria: Record<string, number | null>,
  field: string,
): OralExamCriterionValue {
  const value = toFiniteNumber(criteria[field]);
  const index = value === null ? -1 : (MATRIX_VALUES as readonly number[]).indexOf(value);
  if (index < 0) {
    throw new AppError(
      `The finalized evaluation has an invalid or missing ${field} criterion value.`,
      422,
    );
  }
  return MATRIX_PRINTED[index];
}

function printedAverage(value: unknown, label: string): string {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 1 || parsed > 2.5) {
    throw new AppError(
      `The finalized evaluation has an invalid ${label} average.`,
      422,
    );
  }
  return parsed.toFixed(2);
}

function matchesMagic(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= PNG_MAGIC.length && PNG_MAGIC.every((byte, i) => bytes[i] === byte);
  }
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Decode the exact evaluator's stored signature evidence. The data URL prefix is
 * authoritative; unsupported MIME, malformed base64, mismatched image bytes,
 * missing evidence, and oversized payloads all fail closed.
 */
export function decodeEvaluatorSignature(
  signatureData: string | null | undefined,
): PdfImageInput {
  const evidence = typeof signatureData === "string" ? signatureData.trim() : "";
  if (!evidence) {
    throw new AppError(
      "The finalized evaluation has no required evaluator signature evidence.",
      409,
    );
  }

  const match = SIGNATURE_DATA_URL.exec(evidence);
  if (!match) {
    throw new AppError(
      "The evaluator signature evidence is malformed or uses an unsupported image type.",
      422,
    );
  }

  const mimeType = match[1] as "image/png" | "image/jpeg";
  const payload = match[2];
  if (!payload || payload.length % 4 !== 0) {
    throw new AppError(
      "The evaluator signature evidence contains invalid base64 data.",
      422,
    );
  }

  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) {
    throw new AppError(
      "The evaluator signature evidence contains invalid base64 data.",
      422,
    );
  }
  if (bytes.length > MAX_SIGNATURE_BYTES) {
    throw new AppError(
      `The evaluator signature evidence exceeds the ${MAX_SIGNATURE_BYTES}-byte official-form limit.`,
      413,
    );
  }
  if (!matchesMagic(bytes, mimeType)) {
    throw new AppError(
      "The evaluator signature image data does not match its declared image type.",
      422,
    );
  }

  return { bytes, mimeType };
}

/**
 * Pure mapping from the exact official Criteria record to the accepted
 * TEMPLATE-1 contract. Finalized `officialSnapshot` academic values win over the
 * mutable record columns. No averages, ratings, or verdicts are computed here.
 */
export function mapOfficialCriteriaToRenderInput(
  record: OfficialCriteriaDto,
  logos: InstitutionalLogos,
): OralExamCriteriaRenderInput {
  const snapshot = record.officialSnapshot;
  if (!record.available || record.status !== "FINALIZED" || !snapshot) {
    throw new AppError(
      "The individual evaluation must be finalized and signed before the official PDF can be generated.",
      409,
    );
  }

  if (snapshot.scoringVersion !== INSTITUTIONAL_MATRIX_V2) {
    throw new AppError(
      "Legacy evaluations cannot be rendered on the current institutional form.",
      422,
    );
  }

  const candidateName = nonEmpty(snapshot.studentName ?? record.studentName);
  if (!candidateName) {
    throw new AppError(
      "The official evaluation is missing the candidate name required by the form.",
      422,
    );
  }

  const course = nonEmpty(snapshot.program ?? record.program);
  if (!course) {
    throw new AppError(
      "The official evaluation is missing the program required by the form.",
      422,
    );
  }

  const evaluatorPrintedName = nonEmpty(snapshot.evaluatorName ?? record.evaluatorName);
  if (!evaluatorPrintedName) {
    throw new AppError(
      "The official evaluation is missing the evaluator name required by the form.",
      422,
    );
  }

  const criteria = (snapshot.criteria ?? {}) as Record<string, number | null>;

  const groupI = [
    printedCriterion(criteria, GROUP_I_FIELDS[0]),
    printedCriterion(criteria, GROUP_I_FIELDS[1]),
    printedCriterion(criteria, GROUP_I_FIELDS[2]),
    printedCriterion(criteria, GROUP_I_FIELDS[3]),
    printedCriterion(criteria, GROUP_I_FIELDS[4]),
  ] as const;

  const groupII = [
    printedCriterion(criteria, GROUP_II_FIELDS[0]),
    printedCriterion(criteria, GROUP_II_FIELDS[1]),
    printedCriterion(criteria, GROUP_II_FIELDS[2]),
    printedCriterion(criteria, GROUP_II_FIELDS[3]),
  ] as const;

  return {
    logos,
    candidateName,
    course,
    date: formatOfficialFormDate(snapshot.defenseDate ?? record.defenseDate),
    groupI,
    groupII,
    groupIAverage: printedAverage(snapshot.groupIValue, "Group I"),
    groupIIAverage: printedAverage(snapshot.groupIIValue, "Group II"),
    recommendations: snapshot.recommendations ?? "",
    rating: snapshot.rating ?? "",
    remarks: "",
    evaluatorPrintedName,
    evaluatorSignature: decodeEvaluatorSignature(record.signatureData),
  };
}

function printedSummaryValue(
  value: unknown,
  label: string,
  evaluatorName: string,
): string {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 1 || parsed > 2.5) {
    throw new AppError(
      `The Oral Examination Summary has an invalid ${label} value for evaluator ${evaluatorName}.`,
      422,
    );
  }
  return parsed.toFixed(2);
}

/**
 * Pure mapping from the exact persisted Oral Examination Summary snapshot to the
 * accepted TEMPLATE-2 contract. Examiner rows, order, and Average come from the
 * frozen snapshot only; nothing is recalculated or regenerated here.
 */
export function mapOfficialSummaryToRenderInput(
  source: OfficialSummaryDocumentSource,
  logos: InstitutionalLogos,
): OralExamSummaryRenderInput {
  const snapshot = source.snapshot;
  if (!snapshot) {
    throw new AppError(
      "The Oral Examination Summary is not yet available for this defense.",
      409,
    );
  }
  if (snapshot.schemaVersion !== 1) {
    throw new AppError(
      "The Oral Examination Summary uses an unsupported snapshot schema.",
      422,
    );
  }

  const evaluators = Array.isArray(snapshot.evaluators) ? snapshot.evaluators : [];
  if (evaluators.length === 0) {
    throw new AppError(
      "The Oral Examination Summary has no evaluator rows to print.",
      422,
    );
  }
  if (evaluators.length > 6) {
    throw new AppError(
      "The Oral Examination Summary has more than six examiner rows and cannot fit the official form.",
      422,
    );
  }

  if (!evaluators.every((row) => row.scoringVersion === INSTITUTIONAL_MATRIX_V2)) {
    const onlyLegacy = evaluators.every(
      (row) => row.scoringVersion === LEGACY_POINTS_V1,
    );
    if (onlyLegacy) {
      throw new AppError(
        "Legacy Oral Examination Summary rows cannot be rendered on the current institutional form.",
        422,
      );
    }
    throw new AppError(
      "The Oral Examination Summary has mixed or unsupported scoring versions.",
      422,
    );
  }

  if (
    evaluators.some(
      (row) =>
        row.functionalRole !== "CHAIRMAN" && row.functionalRole !== "PANELIST",
    )
  ) {
    throw new AppError(
      "The Oral Examination Summary contains an unsupported evaluator role.",
      422,
    );
  }

  const chairmen = evaluators.filter((row) => row.functionalRole === "CHAIRMAN");
  if (chairmen.length !== 1) {
    throw new AppError(
      "The Oral Examination Summary must contain exactly one Chairman.",
      422,
    );
  }
  const panelists = evaluators.filter((row) => row.functionalRole === "PANELIST");
  if (panelists.length > 5) {
    throw new AppError(
      "The Oral Examination Summary has more than five printed Member rows.",
      422,
    );
  }

  const candidateName = nonEmpty(snapshot.studentName);
  if (!candidateName) {
    throw new AppError(
      "The Oral Examination Summary is missing the candidate name required by the form.",
      422,
    );
  }
  const course = nonEmpty(snapshot.program);
  if (!course) {
    throw new AppError(
      "The Oral Examination Summary is missing the program required by the form.",
      422,
    );
  }
  const studentNumber = nonEmpty(snapshot.studentNumber);
  if (!studentNumber) {
    throw new AppError(
      "The Oral Examination Summary is missing the student number required by the form.",
      422,
    );
  }

  const examinerRows: OralExamSummaryExaminerRow[] = [];
  const printableNames = new Map<string, string>();
  for (const row of evaluators) {
    const evaluatorName = nonEmpty(row.evaluatorName);
    if (!evaluatorName) {
      throw new AppError(
        "The Oral Examination Summary is missing an evaluator name required by the form.",
        422,
      );
    }
    printableNames.set(row.panelAssignmentId, evaluatorName);
    examinerRows.push({
      examinerName: evaluatorName,
      groupARating: printedSummaryValue(row.groupIValue, "Group A", evaluatorName),
      groupBRating: printedSummaryValue(row.groupIIValue, "Group B", evaluatorName),
      average: printedSummaryValue(row.averageValue, "Average", evaluatorName),
    });
  }

  const isTitle = source.defenseType === "TITLE_DEFENSE";
  const adviserName = isTitle ? "" : nonEmpty(source.adviserName);
  if (!isTitle && !adviserName) {
    throw new AppError(
      "The Oral Examination Summary requires the exact scheduled Adviser name.",
      409,
    );
  }

  return {
    logos,
    candidateName,
    course,
    date: formatOfficialFormDate(snapshot.defenseDate),
    studentNumber,
    examiners: examinerRows,
    submittedBy: {
      chairmanName: printableNames.get(chairmen[0].panelAssignmentId) as string,
      memberNames: panelists.map(
        (row) => printableNames.get(row.panelAssignmentId) as string,
      ),
    },
    adviserName: adviserName ?? "",
    deanName: "",
  };
}

export class OfficialDefenseDocumentService {
  private readonly records: RecordsReader;
  private readonly loadLogos: () => Promise<InstitutionalLogos>;
  private readonly render: (input: OralExamCriteriaRenderInput) => Promise<Uint8Array>;
  private readonly renderSummary: (input: OralExamSummaryRenderInput) => Promise<Uint8Array>;

  constructor(deps: OfficialDefenseDocumentDeps = {}) {
    this.records = deps.records ?? new OfficialDefenseRecordService();
    this.loadLogos = deps.loadLogos ?? loadOfficialFormLogos;
    this.render = deps.render ?? renderOralExamCriteria;
    this.renderSummary = deps.renderSummary ?? renderOralExamSummary;
  }

  /**
   * Generate the Individual Oral Examination Criteria PDF for the EXACT
   * schedule + evaluator assignment. FORM-INT-1 is ADMIN-only. The actor is
   * still forwarded to the official-record authority for defense in depth.
   */
  async generateIndividualEvaluationPdf(
    scheduleId: string,
    panelAssignmentId: string,
    actor: OfficialDefenseDocumentActor,
  ): Promise<Uint8Array> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const record = await this.records.getOfficialCriteria(
      scheduleId,
      panelAssignmentId,
      actor,
    );
    const logos = await this.loadLogos();
    const input = mapOfficialCriteriaToRenderInput(record, logos);

    try {
      return await this.render(input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof RangeError) {
        throw new AppError(
          "The finalized evaluation cannot fit the official individual evaluation form.",
          422,
        );
      }
      throw new AppError(
        "The official individual evaluation could not be generated.",
        500,
      );
    }
  }

  /**
   * Generate the GS-011 Oral Examination Summary PDF for the EXACT schedule
   * from the persisted official summary snapshot. FORM-INT-2 is ADMIN-only and
   * never regenerates the summary or embeds digital signatures.
   */
  async generateOralExamSummaryPdf(
    scheduleId: string,
    actor: OfficialDefenseDocumentActor,
  ): Promise<Uint8Array> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const source = await this.records.getOfficialSummaryDocumentSource(
      scheduleId,
      actor,
    );
    const logos = await this.loadLogos();
    const input = mapOfficialSummaryToRenderInput(source, logos);

    try {
      return await this.renderSummary(input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof RangeError) {
        throw new AppError(
          "The persisted Oral Examination Summary cannot fit the official summary form.",
          422,
        );
      }
      throw new AppError(
        "The official Oral Examination Summary could not be generated.",
        500,
      );
    }
  }
}
