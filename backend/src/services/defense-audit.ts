import type { Prisma } from "@prisma/client";

/**
 * CDW-9C — production audit coverage for material defense actions.
 *
 * Reuses the existing AuditLog model. Audit rows are metadata only: no
 * signature evidence, evaluator scores, recommendations, report body,
 * manuscript content, storage paths, credentials, or tokens.
 */
export const DEFENSE_AUDIT_ACTIONS = {
  SCHEDULE_CREATED: "DEFENSE_SCHEDULE_CREATED",
  SCHEDULE_CORRECTED: "DEFENSE_SCHEDULE_CORRECTED",
  SESSION_STARTED: "DEFENSE_SESSION_STARTED",
  EVALUATION_FINALIZED: "DEFENSE_EVALUATION_FINALIZED",
  REPORT_FINALIZED: "DEFENSE_REPORT_FINALIZED",
  REPORT_SIGNED: "DEFENSE_REPORT_SIGNED",
  VERDICT_RECORDED: "DEFENSE_VERDICT_RECORDED",
} as const;

export type DefenseAuditAction =
  (typeof DEFENSE_AUDIT_ACTIONS)[keyof typeof DEFENSE_AUDIT_ACTIONS];

export const DEFENSE_AUDIT_TARGETS = {
  SESSION: "defense_schedules",
  EVALUATION: "oral_exam_scores",
  REPORT: "rap_reports",
  SIGNATURE: "rap_report_signatures",
  CONCLUSION: "defense_conclusions",
} as const;

export type DefenseAuditTarget =
  (typeof DEFENSE_AUDIT_TARGETS)[keyof typeof DEFENSE_AUDIT_TARGETS];

export interface DefenseAuditMetadata {
  scheduleId: string;
  thesisId?: string;
  defenseType?: string;
  previousStatus?: string;
  newStatus?: string;
  panelAssignmentId?: string;
  reportId?: string;
  signatureId?: string;
  contentVersion?: number;
  requiredSigners?: number;
  outcome?: string;
}

const ALLOWED_METADATA_KEYS = new Set<keyof DefenseAuditMetadata>([
  "scheduleId",
  "thesisId",
  "defenseType",
  "previousStatus",
  "newStatus",
  "panelAssignmentId",
  "reportId",
  "signatureId",
  "contentVersion",
  "requiredSigners",
  "outcome",
]);

const AUDIT_DESCRIPTION: Record<DefenseAuditAction, string> = {
  DEFENSE_SCHEDULE_CREATED: "Defense schedule and committee created.",
  DEFENSE_SCHEDULE_CORRECTED: "Defense schedule and committee corrected.",
  DEFENSE_SESSION_STARTED: "Defense session started.",
  DEFENSE_EVALUATION_FINALIZED: "Oral evaluation finalized.",
  DEFENSE_REPORT_FINALIZED: "Committee Report finalized for signatures.",
  DEFENSE_REPORT_SIGNED: "Committee Report signature recorded.",
  DEFENSE_VERDICT_RECORDED: "Formal defense verdict recorded.",
};

type AuditDb = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Runtime allow-list. Even if a caller accidentally supplies a sensitive field,
 * it can never enter the persisted audit payload.
 */
export function sanitizeDefenseAuditMetadata(
  metadata: DefenseAuditMetadata,
): Partial<DefenseAuditMetadata> {
  const safe: Partial<DefenseAuditMetadata> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key as keyof DefenseAuditMetadata)) continue;
    if (value === undefined || value === null || value === "") continue;
    (safe as Record<string, unknown>)[key] = value;
  }
  return safe;
}

export async function writeDefenseAudit(
  db: AuditDb,
  input: {
    actorId: string;
    actionType: DefenseAuditAction;
    targetTable: DefenseAuditTarget;
    targetId: string;
    metadata: DefenseAuditMetadata;
  },
): Promise<void> {
  const safeMetadata = sanitizeDefenseAuditMetadata(input.metadata);
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      actionType: input.actionType,
      targetTable: input.targetTable,
      targetId: input.targetId,
      oldValue: null,
      newValue: JSON.stringify(safeMetadata),
      description: AUDIT_DESCRIPTION[input.actionType],
      ipAddress: null,
    },
  });
}

export type DefenseScheduleAuditAction =
  | typeof DEFENSE_AUDIT_ACTIONS.SCHEDULE_CREATED
  | typeof DEFENSE_AUDIT_ACTIONS.SCHEDULE_CORRECTED;

export interface DefenseScheduleAuditSnapshot {
  scheduleId: string;
  thesisId: string;
  defenseType: string;
  schedule: {
    defenseDate: string;
    defenseTime: string;
    venueOrLink: string | null;
  };
  committee: Array<{
    assignmentId: string;
    userId: string;
    displayName: string;
    role: string;
  }>;
}

function auditInstant(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function buildDefenseScheduleAuditSnapshot(input: {
  id: string;
  thesisId: string;
  defenseType: unknown;
  defenseDate: Date | string;
  defenseTime: Date | string;
  venueOrLink: string | null;
  panelAssignments: Array<{
    id: string;
    userId: string;
    role: unknown;
    user: { firstName: string | null; lastName: string | null } | null;
  }>;
}): DefenseScheduleAuditSnapshot {
  return {
    scheduleId: input.id,
    thesisId: input.thesisId,
    defenseType: String(input.defenseType),
    schedule: {
      defenseDate: auditInstant(input.defenseDate),
      defenseTime: auditInstant(input.defenseTime),
      venueOrLink: input.venueOrLink ?? null,
    },
    committee: input.panelAssignments.map((assignment) => ({
      assignmentId: assignment.id,
      userId: assignment.userId,
      displayName:
        `${assignment.user?.firstName ?? ""} ${assignment.user?.lastName ?? ""}`.trim() ||
        assignment.userId,
      role: String(assignment.role),
    })),
  };
}

export async function writeDefenseScheduleAudit(
  db: AuditDb,
  input: {
    actorId: string;
    actionType: DefenseScheduleAuditAction;
    before: DefenseScheduleAuditSnapshot | null;
    after: DefenseScheduleAuditSnapshot;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      actionType: input.actionType,
      targetTable: DEFENSE_AUDIT_TARGETS.SESSION,
      targetId: input.after.scheduleId,
      oldValue: input.before ? JSON.stringify(input.before) : null,
      newValue: JSON.stringify(input.after),
      description: AUDIT_DESCRIPTION[input.actionType],
      ipAddress: null,
    },
  });
}
