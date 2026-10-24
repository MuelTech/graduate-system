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
import { PDFDocument } from "pdf-lib";

import { AppError } from "../utils/AppError";
import {
  INSTITUTIONAL_MATRIX_V2,
} from "./oral-evaluation.institutional.rules";
import {
  officialDefenseDocumentFilename,
  type OfficialDefenseDocumentKind,
} from "./official-defense-document-filename";
import {
  OfficialDefenseRecordService,
  type OfficialCriteriaDto,
} from "./official-defense-record.service";
import { loadOfficialFormLogos } from "./official-form-assets";
import {
  formatOfficialApplicationDate,
  formatOfficialApplicationDateTime,
  formatOfficialFormDate,
  formatOfficialFormTime,
} from "./official-form-display";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { renderDefenseApplication } from "../documents/official-defense/defense-application/defense-application.renderer";
import type { DefenseApplicationRenderInput } from "../documents/official-defense/defense-application/defense-application.types";
import type { DefenseTypeName } from "../interfaces/defense-eligibility.interfaces";
import type { ProgramTypeKey } from "../interfaces/defense-committee.interfaces";
import { renderOralExamCriteria } from "../documents/official-defense/oral-exam-criteria/oral-exam-criteria.renderer";
import type {
  OralExamCriteriaRenderInput,
  OralExamCriterionValue,
} from "../documents/official-defense/oral-exam-criteria/oral-exam-criteria.types";
import { renderOralExamSummary } from "../documents/official-defense/oral-exam-summary/oral-exam-summary.renderer";
import type {
  OralExamSummaryExaminerRow,
  OralExamSummaryRenderInput,
  OralExamSummaryStage,
} from "../documents/official-defense/oral-exam-summary/oral-exam-summary.types";
import type { InstitutionalLogos } from "../documents/official-defense/shared/institutional-header";
import type { PdfImageInput } from "../documents/official-defense/shared/pdf-layout";
import { LEGACY_POINTS_V1 } from "./oral-evaluation.institutional.rules";
import type {
  DefenseApplicationAssignmentSource,
  OfficialDefenseApplicationDocumentSource,
  OfficialSummaryDocumentSource,
} from "./official-defense-record.service";

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
  | "getOfficialCriteria"
  | "getOfficialSummaryDocumentSource"
  | "getOfficialDefenseApplicationDocumentSource"
>;

type BundleRecordsReader = Pick<
  OfficialDefenseRecordService,
  "getOfficialCriteria" | "getOfficialEvaluationBundleSource"
>;
type FilenameSourceReader = Pick<
  OfficialDefenseRecordService,
  "getOfficialDocumentIdentity"
>;

export interface OfficialDefenseDocumentDeps {
  readonly records?: RecordsReader;
  /** Optional seam for the bundled evaluator packet. */
  readonly bundleRecords?: BundleRecordsReader;
  /** Optional seam for canonical readable filenames. */
  readonly filenameSource?: FilenameSourceReader;
  readonly loadLogos?: () => Promise<InstitutionalLogos>;
  readonly render?: (input: OralExamCriteriaRenderInput) => Promise<Uint8Array>;
  readonly renderSummary?: (input: OralExamSummaryRenderInput) => Promise<Uint8Array>;
  readonly renderApplication?: (
    input: DefenseApplicationRenderInput,
  ) => Promise<Uint8Array>;
}

const committeePolicy = new DefenseCommitteePolicy();

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

  const stage = summaryStage(source.defenseType);
  const isTitle = stage === "title";
  const adviserName = isTitle ? "" : nonEmpty(source.adviserName);
  if (!isTitle && !adviserName) {
    throw new AppError(
      "The Oral Examination Summary requires the exact scheduled Adviser name.",
      409,
    );
  }

  return {
    logos,
    stage,
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

const APPLICATION_TYPES: Record<string, OralExamSummaryStage> = {
  TITLE_DEFENSE: "title",
  PROPOSAL_DEFENSE: "proposal",
  FINAL_DEFENSE: "final",
};

/** Explicit exact-schedule stage mapping; unsupported values fail closed. */
function summaryStage(defenseType: string): OralExamSummaryStage {
  const stage = APPLICATION_TYPES[defenseType];
  if (!stage) {
    throw new AppError(
      "The Oral Examination Summary has an unsupported defense stage.",
      422,
    );
  }
  return stage;
}

/** Deterministic printed Panelist order: createdAt ascending, then id ascending. */
function comparePanelists(
  a: DefenseApplicationAssignmentSource,
  b: DefenseApplicationAssignmentSource,
): number {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);
  const aValid = Number.isFinite(aTime);
  const bValid = Number.isFinite(bTime);
  if (aValid && bValid && aTime !== bTime) return aTime - bTime;
  if (aValid !== bValid) return aValid ? -1 : 1;
  return a.panelAssignmentId.localeCompare(b.panelAssignmentId);
}

function printableAssignmentName(
  assignment: DefenseApplicationAssignmentSource,
): string {
  const name = nonEmpty(assignment.name);
  if (!name) {
    throw new AppError(
      `The ${assignment.role.toLowerCase()} assignment has no printable name.`,
      409,
    );
  }
  return name;
}

/**
 * Pure mapping from the exact schedule source to the accepted TEMPLATE-3
 * contract. Committee quotas and role requirements come from the centralized
 * `DefenseCommitteePolicy`; the integration does not maintain a second table.
 * Fields without an approved authoritative source stay intentionally blank.
 */
export function mapDefenseApplicationToRenderInput(
  source: OfficialDefenseApplicationDocumentSource,
  logos: InstitutionalLogos,
): DefenseApplicationRenderInput {
  const programTypeRaw = String(source.programType ?? "").toUpperCase();
  let variant: "masters" | "doctoral";
  if (programTypeRaw === "MASTERS") variant = "masters";
  else if (programTypeRaw === "DOCTORAL") variant = "doctoral";
  else {
    throw new AppError(
      "The defense application has an unsupported program type.",
      422,
    );
  }

  const defenseTypeRaw = String(source.defenseType ?? "").toUpperCase();
  const applicationType = APPLICATION_TYPES[defenseTypeRaw];
  if (!applicationType) {
    throw new AppError(
      "The defense application has an unsupported defense type.",
      422,
    );
  }

  const studentName = nonEmpty(source.studentName);
  if (!studentName) {
    throw new AppError(
      "The defense schedule is missing the student name required by the application form.",
      422,
    );
  }
  const programName = nonEmpty(source.programName);
  if (!programName) {
    throw new AppError(
      "The defense schedule is missing the program required by the application form.",
      422,
    );
  }

  const policy = committeePolicy.getPolicy(
    defenseTypeRaw as DefenseTypeName,
    programTypeRaw as ProgramTypeKey,
  );
  const assignments = Array.isArray(source.assignments)
    ? source.assignments
    : [];

  for (const assignment of assignments) {
    if (
      !policy.allowedRoles.includes(
        String(assignment.role) as never,
      )
    ) {
      if (assignment.role === "ADVISER" && policy.adviserMode === "NONE") {
        throw new AppError(
          "Title Defense applications cannot include an Adviser seat.",
          409,
        );
      }
      throw new AppError(
        `Role ${assignment.role} is not allowed for this defense application.`,
        409,
      );
    }
  }

  const seenUsers = new Set<string>();
  for (const assignment of assignments) {
    if (seenUsers.has(assignment.userId)) {
      throw new AppError(
        "The defense committee cannot assign the same user to more than one seat.",
        409,
      );
    }
    seenUsers.add(assignment.userId);
  }

  const roleOf = (role: string) =>
    assignments.filter((assignment) => assignment.role === role);

  const chairmen = roleOf("CHAIRMAN");
  if (chairmen.length !== 1) {
    throw new AppError(
      "The defense application requires exactly one Chairman assignment.",
      409,
    );
  }

  const panelists = roleOf("PANELIST").sort(comparePanelists);
  if (panelists.length !== policy.panelistCount) {
    throw new AppError(
      `The defense application requires exactly ${policy.panelistCount} Panelist assignment(s) for this stage (got ${panelists.length}).`,
      409,
    );
  }

  const facilitators = roleOf("FACILITATOR");
  if (facilitators.length !== 1) {
    throw new AppError(
      "The defense application requires exactly one Facilitator assignment.",
      409,
    );
  }

  const rapporteurs = roleOf("RAPPORTEUR");
  if (rapporteurs.length !== 1) {
    throw new AppError(
      "The defense application requires exactly one Rapporteur assignment.",
      409,
    );
  }

  const advisers = roleOf("ADVISER");
  if (policy.adviserMode === "NONE") {
    if (advisers.length !== 0) {
      throw new AppError(
        "Title Defense applications cannot include an Adviser seat.",
        409,
      );
    }
  } else if (advisers.length !== 1) {
    throw new AppError(
      "Proposal and Final Defense applications require exactly one exact-schedule Adviser.",
      409,
    );
  }

  if (assignments.length !== policy.sessionTotal) {
    throw new AppError(
      `The defense application requires exactly ${policy.sessionTotal} committee assignments (got ${assignments.length}).`,
      409,
    );
  }

  const chairmanName = printableAssignmentName(chairmen[0]);
  const panelistNames = [chairmanName, ...panelists.map(printableAssignmentName)];
  const adviserName =
    advisers.length === 1 ? printableAssignmentName(advisers[0]) : "";

  return {
    logos,
    variant,
    applicationType,
    studentName,
    courseAndMajor: programName,
    studentNumber: source.studentNumber ?? "",
    cellphoneNumber: source.cellphone ?? "",
    // Exact Student email + the latest successful filing for the exact stage.
    applicantDateAndTime: formatOfficialApplicationDateTime(
      source.applicationSubmittedAt,
    ),
    // Client policy for payment/O.R. remains unconfirmed; keep these blank.
    amountPaid: "",
    officialReceiptNumber: "",
    dateOfApplication: formatOfficialApplicationDate(
      source.applicationSubmittedAt,
    ),
    personalGmail: source.studentEmail ?? "",
    defenseDate: formatOfficialFormDate(source.defenseDate),
    defenseTime: formatOfficialFormTime(source.defenseTime),
    defenseLink: source.venueOrLink ?? "",
    committee: {
      adviserName,
      panelistNames,
      facilitatorName: printableAssignmentName(facilitators[0]),
      rapporteurName: printableAssignmentName(rapporteurs[0]),
    },
    deanName: "",
    vicePresidentName: "",
    presidentName: "",
  };
}

export class OfficialDefenseDocumentService {
  private readonly records: RecordsReader;
  private readonly bundleRecords: BundleRecordsReader;
  private readonly filenameSource: FilenameSourceReader;
  private readonly loadLogos: () => Promise<InstitutionalLogos>;
  private readonly render: (input: OralExamCriteriaRenderInput) => Promise<Uint8Array>;
  private readonly renderSummary: (input: OralExamSummaryRenderInput) => Promise<Uint8Array>;
  private readonly renderApplication: (
    input: DefenseApplicationRenderInput,
  ) => Promise<Uint8Array>;

  constructor(deps: OfficialDefenseDocumentDeps = {}) {
    this.records = deps.records ?? new OfficialDefenseRecordService();
    this.bundleRecords = deps.bundleRecords ?? new OfficialDefenseRecordService();
    this.filenameSource =
      deps.filenameSource ?? new OfficialDefenseRecordService();
    this.loadLogos = deps.loadLogos ?? loadOfficialFormLogos;
    this.render = deps.render ?? renderOralExamCriteria;
    this.renderSummary = deps.renderSummary ?? renderOralExamSummary;
    this.renderApplication = deps.renderApplication ?? renderDefenseApplication;
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

  /**
   * Generate the GS-006/GS-007 Defense Application PDF from the EXACT scheduled
   * defense. FORM-INT-3 is ADMIN-only and a current-record on-demand print; it
   * does not persist or version generated documents.
   */
  async generateDefenseApplicationPdf(
    scheduleId: string,
    actor: OfficialDefenseDocumentActor,
  ): Promise<Uint8Array> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const source =
      await this.records.getOfficialDefenseApplicationDocumentSource(
        scheduleId,
        actor,
      );
    const logos = await this.loadLogos();
    const input = mapDefenseApplicationToRenderInput(source, logos);

    try {
      return await this.renderApplication(input);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof RangeError) {
        throw new AppError(
          "The defense application cannot fit the official one-page form.",
          422,
        );
      }
      throw new AppError(
        "The official defense application could not be generated.",
        500,
      );
    }
  }

  /**
   * FORM-INT-4 FIX-1: one server-generated evaluator packet for the exact
   * schedule. Every required Chairman/Panelist page must be renderable; any
   * failure aborts the whole packet (no partial output).
   */
  async generateEvaluationBundlePdf(
    scheduleId: string,
    actor: OfficialDefenseDocumentActor,
  ): Promise<Uint8Array> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const source = await this.bundleRecords.getOfficialEvaluationBundleSource(
      scheduleId,
      actor,
    );
    if (source.evaluatorAssignments.length === 0) {
      throw new AppError(
        "The printable evaluator packet has no required evaluator assignments.",
        409,
      );
    }

    const logos = await this.loadLogos();
    const merged = await PDFDocument.create();
    merged.setCreationDate(new Date(0));
    merged.setModificationDate(new Date(0));
    merged.setTitle("EARIST Graduate School - Individual Evaluations");
    merged.setAuthor("EARIST Graduate School");
    merged.setProducer("EARIST Graduate School - Official Forms");

    try {
      for (const assignment of source.evaluatorAssignments) {
        const record = await this.bundleRecords.getOfficialCriteria(
          scheduleId,
          assignment.panelAssignmentId,
          actor,
        );
        if (
          record.scheduleId !== scheduleId ||
          record.panelAssignmentId !== assignment.panelAssignmentId
        ) {
          throw new AppError(
            "The evaluator record does not belong to this exact defense schedule.",
            409,
          );
        }

        const input = mapOfficialCriteriaToRenderInput(record, logos);
        const rendered = await this.render(input);
        const pageDocument = await PDFDocument.load(rendered);
        if (pageDocument.getPageCount() !== 1) {
          throw new AppError(
            "An individual evaluation did not render to exactly one page.",
            500,
          );
        }
        const [page] = await merged.copyPages(pageDocument, [0]);
        merged.addPage(page);
      }

      if (merged.getPageCount() !== source.evaluatorAssignments.length) {
        throw new AppError(
          "The individual evaluation packet page count does not match the required evaluators.",
          500,
        );
      }

      return await merged.save();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof RangeError) {
        throw new AppError(
          "The bundled individual evaluations cannot fit the official form.",
          422,
        );
      }
      throw new AppError(
        "The official individual evaluation packet could not be generated.",
        500,
      );
    }
  }

  /** Canonical readable filename from the exact schedule identity. */
  async buildOfficialDocumentFilename(
    scheduleId: string,
    kind: OfficialDefenseDocumentKind,
    actor: OfficialDefenseDocumentActor,
  ): Promise<string> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }
    const identity = await this.filenameSource.getOfficialDocumentIdentity(
      scheduleId,
      actor,
    );
    return officialDefenseDocumentFilename(
      identity.studentName,
      identity.defenseType,
      kind,
    );
  }
}
