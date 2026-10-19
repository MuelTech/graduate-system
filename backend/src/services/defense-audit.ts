import type { Prisma } from "@prisma/client";

/**
 * CDW-9C — production audit coverage for material defense actions.
 *
 * Reuses the existing AuditLog model. Audit rows are metadata only: no
 * signature evidence, evaluator scores, recommendations, report body,
 * manuscript content, storage paths, credentials, or tokens.
 */
export const DEFENSE_AUDIT_ACTIONS = {
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
