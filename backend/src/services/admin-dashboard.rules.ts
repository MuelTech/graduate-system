/**
 * Admin dashboard read-model rules (pure, no I/O).
 *
 * These functions define the EXACT dashboard metric semantics so the numbers
 * are testable and documented in one place. They must not invent academic
 * policy: every derivation below is a projection of existing authoritative
 * domain records.
 */

export type ThesisPipelineStage = "TITLE" | "PROPOSAL" | "FINAL";
export type DegreeLevel = "MASTERS" | "DOCTORAL";

export interface ThesisPipelineRow {
  stage: ThesisPipelineStage;
  count: number;
}

export interface ThesisRecordInput {
  studentId: string;
  stage: string;
  /** Authoritative ThesisStatus — a latest FAILED record is not an active attempt. */
  status: string;
  createdAt: Date;
  id: string;
}

export interface EnrolledStudentInput {
  programName: string;
  programType: DegreeLevel;
}

export interface EnrollmentSnapshot {
  total: number;
  byDegreeLevel: { degreeLevel: DegreeLevel; count: number }[];
  topPrograms: {
    programName: string;
    degreeLevel: DegreeLevel;
    count: number;
  }[];
}

export interface HumanizedAuditAction {
  action: string;
  detail: string | null;
}

const PIPELINE_STAGES: readonly ThesisPipelineStage[] = [
  "TITLE",
  "PROPOSAL",
  "FINAL",
];

const DEGREE_LEVELS: readonly DegreeLevel[] = ["MASTERS", "DOCTORAL"];

const MAX_TOP_PROGRAMS = 5;

function normalizeStage(stage: string): ThesisPipelineStage | null {
  const value = String(stage ?? "").toUpperCase();
  return (PIPELINE_STAGES as readonly string[]).includes(value)
    ? (value as ThesisPipelineStage)
    : null;
}

/** Newer record wins; equal timestamps break deterministically on higher id. */
function isLaterThan(
  candidate: ThesisRecordInput,
  current: ThesisRecordInput,
): boolean {
  const candidateTime = candidate.createdAt.getTime();
  const currentTime = current.createdAt.getTime();
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return candidate.id > current.id;
}

/**
 * Thesis pipeline = each Student's CURRENT thesis record only.
 *
 * A student has at most one active ThesisRecord (the record is advanced in
 * place from TITLE -> PROPOSAL -> FINAL; a new record is only created after a
 * previous attempt is FAILED). Selecting the latest record per student avoids
 * double-counting historical attempts as simultaneous current stages.
 *
 * A latest FAILED record is a terminal attempt, not a current one: the thesis
 * creation workflow only permits a new Title Defense when the latest record's
 * status is FAILED. Such a student is therefore outside the active pipeline.
 */
export function buildThesisPipeline(
  records: ThesisRecordInput[],
): ThesisPipelineRow[] {
  const latestByStudent = new Map<string, ThesisRecordInput>();
  for (const record of records) {
    const current = latestByStudent.get(record.studentId);
    if (!current || isLaterThan(record, current)) {
      latestByStudent.set(record.studentId, record);
    }
  }

  const counts: Record<ThesisPipelineStage, number> = {
    TITLE: 0,
    PROPOSAL: 0,
    FINAL: 0,
  };
  for (const record of latestByStudent.values()) {
    // Latest FAILED attempt is not an active/current stage.
    if (String(record.status ?? "").toUpperCase() === "FAILED") continue;
    const stage = normalizeStage(record.stage);
    if (stage) counts[stage] += 1;
  }

  return PIPELINE_STAGES.map((stage) => ({ stage, count: counts[stage] }));
}

/**
 * Enrollment snapshot over authoritative ENROLLED students only.
 * Program-level reporting only — no normalized Department entity exists yet.
 */
export function buildEnrollmentSnapshot(
  rows: EnrolledStudentInput[],
): EnrollmentSnapshot {
  const byDegreeLevel: Record<DegreeLevel, number> = {
    MASTERS: 0,
    DOCTORAL: 0,
  };
  const programCounts = new Map<
    string,
    { programName: string; degreeLevel: DegreeLevel; count: number }
  >();

  for (const row of rows) {
    byDegreeLevel[row.programType] += 1;
    const key = `${row.programType}::${row.programName}`;
    const existing = programCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      programCounts.set(key, {
        programName: row.programName,
        degreeLevel: row.programType,
        count: 1,
      });
    }
  }

  const topPrograms = [...programCounts.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.programName < b.programName) return -1;
      if (a.programName > b.programName) return 1;
      return 0;
    })
    .slice(0, MAX_TOP_PROGRAMS);

  return {
    total: rows.length,
    byDegreeLevel: DEGREE_LEVELS.map((degreeLevel) => ({
      degreeLevel,
      count: byDegreeLevel[degreeLevel],
    })),
    topPrograms,
  };
}

/**
 * Known internal audit action codes -> user-facing sentences.
 * Anything unmapped falls back to the audit description, never the raw code.
 */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  cor_upload: "Uploaded a COR submission",
  cor_verify: "Verified a COR submission",
  cor_reject: "Rejected a COR submission",
  defense_application_approve: "Approved a defense application",
  defense_application_reject: "Rejected a defense application",
  defense_resubmit: "Resubmitted a defense application",
  document_view: "Viewed a document",
  document_access_denied: "Denied access to a document",
  waiver_validated: "Validated a bridging waiver",
  waiver_rejected: "Rejected a bridging waiver",
};

export function humanizeAuditAction(
  actionType: string,
  description?: string | null,
): HumanizedAuditAction {
  const key = String(actionType ?? "")
    .trim()
    .toLowerCase();
  const mapped = AUDIT_ACTION_LABELS[key];
  const text = typeof description === "string" ? description.trim() : "";

  if (mapped) {
    const detail =
      text && text.toLowerCase() !== mapped.toLowerCase() ? text : null;
    return { action: mapped, detail };
  }

  return { action: text || "System activity", detail: null };
}
