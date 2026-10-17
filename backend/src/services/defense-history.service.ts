/**
 * CDW-6 — Defense History read model (server-authoritative, read-only).
 *
 * History is CONTEXT ONLY. It is resolved from the exact prior `DefenseSchedule`
 * attempts of the same thesis and never reopened, copied, or mutated. This
 * service exposes only read methods; there is no write path for history.
 *
 * Authorization model:
 *  - authority comes from the caller's PanelAssignment for the CURRENT schedule
 *    (never an account role, never a historical assignment);
 *  - the historical attempt must belong to the SAME thesis and be a genuinely
 *    prior, concluded attempt (relevance/ordering rules shared with the document
 *    authorization via `defense-history.rules`);
 *  - the historical manuscript is the EXACT `manuscriptDocumentId` binding;
 *  - prior individual evaluator criteria/scores and raw signature evidence are
 *    never exposed.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  DEFENSE_TYPE_TO_DOCUMENT_STAGE,
  MANUSCRIPT_DOC_TYPES_BY_STAGE,
  classifyHistoryRelationship,
  isPriorAttempt,
  resolveHistoryScheduleIds,
  type DefenseHistoryRelationship,
} from "./defense-history.rules";
import {
  DefenseCollaborationService,
  type AnnotationDto,
} from "./defense-collaboration.service";

export interface DefenseHistoryManuscriptDto {
  id: string;
  docType: string;
  defenseStage: string | null;
  displayName: string;
  uploadedAt: string | null;
}

export interface DefenseHistoryRapDto {
  id: string;
  status: string;
  finalizedAt: string | null;
  /** Canonical CDW-5 structured report body, when the report has one. */
  bodyDocument: unknown | null;
  /** Legacy raw committee text, rendered honestly as legacy content. */
  decisionsAndRecommendations: string | null;
  /** True when a CDW-5 structured body exists (never fabricated for legacy). */
  isStructured: boolean;
  contentVersion: number | null;
  signatureProgress: { required: number; signed: number };
}

export interface DefenseHistoryCommitteeDto {
  userId: string;
  name: string;
  role: string;
}

export interface DefenseHistoryItemDto {
  scheduleId: string;
  defenseType: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  relationship: DefenseHistoryRelationship;
  defenseDate: string | null;
  defenseTime: string | null;
  venueOrLink: string | null;
  sessionStatus: string;
  verdict: string | null;
  concludedAt: string | null;
  /** The EXACT manuscript bound to this historical attempt; null if unbound. */
  manuscript: DefenseHistoryManuscriptDto | null;
  rapAvailable: boolean;
  annotationCount: number;
  commentCount: number;
  committee: DefenseHistoryCommitteeDto[];
}

export interface DefenseHistoryDto {
  scheduleId: string;
  defenseType: string;
  items: DefenseHistoryItemDto[];
}

export interface DefenseHistoryAttemptDetailDto extends DefenseHistoryItemDto {
  rap: DefenseHistoryRapDto | null;
  annotations: AnnotationDto[];
}

/** Minimal read contract this service needs from the collaboration layer. */
export interface DefenseHistoryAnnotationReader {
  listAttemptAnnotationsForHistory(
    scheduleId: string,
    thesisDocumentId: string,
  ): Promise<AnnotationDto[]>;
}

const MANUSCRIPT_STAGE_LABEL: Record<string, string> = {
  TITLE: "Historical Title Proposal",
  PROPOSAL: "Historical Proposal Manuscript",
  FINAL: "Historical Final Manuscript",
};

const LATEST_RAP_ORDER = { createdAt: "desc" as const };

const MANUSCRIPT_TYPE_BY_STAGE = MANUSCRIPT_DOC_TYPES_BY_STAGE;

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function wallDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wallTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function personName(user: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!user) return "";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

type ScheduleRow = {
  id: string;
  thesisId: string;
  defenseType: unknown;
  sessionStatus: unknown;
  defenseDate: Date;
  defenseTime: Date;
  venueOrLink: string | null;
  createdAt: Date;
  manuscriptDocumentId: string | null;
  conclusion: { outcome: unknown; concludedAt: Date } | null;
  manuscriptDocument: {
    id: string;
    thesisId: string;
    docType: unknown;
    defenseStage: unknown;
    uploadedAt: Date;
  } | null;
  panelAssignments: Array<{
    userId: string;
    role: unknown;
    user: { firstName: string | null; lastName: string | null } | null;
  }>;
  rapReports: Array<{
    id: string;
    status: unknown;
    finalizedAt: Date | null;
    bodyDocument: unknown;
    decisionsAndRecommendations: string | null;
    contentVersion: number;
    signatures: Array<{ required: boolean | null; isSigned: boolean | null }>;
  }>;
  _count: { annotations: number };
};

const SCHEDULE_SELECT = {
  id: true,
  thesisId: true,
  defenseType: true,
  sessionStatus: true,
  defenseDate: true,
  defenseTime: true,
  venueOrLink: true,
  createdAt: true,
  manuscriptDocumentId: true,
  conclusion: { select: { outcome: true, concludedAt: true } },
  manuscriptDocument: {
    select: {
      id: true,
      thesisId: true,
      docType: true,
      defenseStage: true,
      uploadedAt: true,
    },
  },
  panelAssignments: {
    select: {
      userId: true,
      role: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  rapReports: {
    orderBy: LATEST_RAP_ORDER,
    take: 1,
    select: {
      id: true,
      status: true,
      finalizedAt: true,
      bodyDocument: true,
      decisionsAndRecommendations: true,
      contentVersion: true,
      signatures: { select: { required: true, isSigned: true } },
    },
  },
  _count: { select: { annotations: true } },
} as const;

export class DefenseHistoryService {
  constructor(
    private readonly annotations: DefenseHistoryAnnotationReader = new DefenseCollaborationService(),
  ) {}

  /**
   * Relevant prior attempts for the CURRENT schedule, ordered deterministically
   * (same-stage re-defense → previous stage → older history).
   */
  async getHistory(scheduleId: string, userId: string): Promise<DefenseHistoryDto> {
    const current = await this.loadCurrentSchedule(scheduleId);
    await this.assertAssignedToCurrent(scheduleId, userId);

    const candidates = (await prisma.defenseSchedule.findMany({
      where: { thesisId: current.thesisId },
      select: SCHEDULE_SELECT,
    })) as unknown as ScheduleRow[];

    const ordered = resolveHistoryScheduleIds(
      {
        scheduleId: current.id,
        defenseType: String(current.defenseType),
        defenseDate: current.defenseDate,
        createdAt: current.createdAt,
      },
      candidates.map((row) => ({
        scheduleId: row.id,
        defenseType: String(row.defenseType),
        outcome: row.conclusion?.outcome ? String(row.conclusion.outcome) : null,
        defenseDate: row.defenseDate,
        createdAt: row.createdAt,
        concludedAt: row.conclusion?.concludedAt ?? null,
      })),
    );

    const byId = new Map(candidates.map((row) => [row.id, row]));
    const commentCounts = await this.loadCommentCounts(ordered.map((item) => item.scheduleId));

    const items: DefenseHistoryItemDto[] = [];
    for (const resolved of ordered) {
      const row = byId.get(resolved.scheduleId);
      if (!row) continue;
      items.push({
        ...this.toBaseItem(row, resolved.relationship),
        annotationCount: row._count?.annotations ?? 0,
        commentCount: commentCounts.get(row.id) ?? 0,
      });
    }

    return {
      scheduleId: current.id,
      defenseType: String(current.defenseType),
      items,
    };
  }

  /**
   * Read-only detail for ONE historical attempt, gated by a CURRENT assignment.
   */
  async getHistoryDetail(
    scheduleId: string,
    historicalScheduleId: string,
    userId: string,
  ): Promise<DefenseHistoryAttemptDetailDto> {
    if (!historicalScheduleId) {
      throw new AppError("A historical defense session is required.", 400);
    }
    const current = await this.loadCurrentSchedule(scheduleId);
    await this.assertAssignedToCurrent(scheduleId, userId);

    if (historicalScheduleId === current.id) {
      throw new AppError(
        "The current defense session is not a historical attempt.",
        403,
      );
    }

    const historical = (await prisma.defenseSchedule.findUnique({
      where: { id: historicalScheduleId },
      select: SCHEDULE_SELECT,
    })) as unknown as ScheduleRow | null;
    if (!historical) throw new AppError("Historical defense session not found.", 404);

    // Cross-thesis access is never permitted. 404 (not 403) avoids confirming
    // the existence of another thesis's attempt.
    if (historical.thesisId !== current.thesisId) {
      throw new AppError("Historical defense session not found.", 404);
    }

    const relationship = this.resolveRelationship(current as unknown as ScheduleRow, historical);
    if (!relationship) {
      throw new AppError(
        "This defense attempt is not relevant historical context for the current session.",
        403,
      );
    }

    // Exact binding only — never a latest/current substitute.
    const manuscript = this.resolveBoundManuscript(historical);
    const annotations = manuscript
      ? await this.annotations.listAttemptAnnotationsForHistory(historical.id, manuscript.id)
      : [];
    const commentCount = annotations.reduce(
      (total, annotation) => total + annotation.comments.length,
      0,
    );

    return {
      ...this.toBaseItem(historical, relationship),
      annotationCount: historical._count?.annotations ?? 0,
      commentCount,
      manuscript,
      rap: this.toRapDto(historical),
      annotations,
    };
  }

  private async loadCurrentSchedule(scheduleId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        thesisId: true,
        defenseType: true,
        defenseDate: true,
        createdAt: true,
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    return schedule;
  }

  private async assertAssignedToCurrent(scheduleId: string, userId: string): Promise<void> {
    const assignment = await prisma.panelAssignment.findFirst({
      where: { scheduleId, userId },
      select: { id: true },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
  }

  private resolveRelationship(
    current: ScheduleRow,
    historical: ScheduleRow,
  ): DefenseHistoryRelationship | null {
    const historicalAttempt = {
      scheduleId: historical.id,
      defenseType: String(historical.defenseType),
      outcome: historical.conclusion?.outcome ? String(historical.conclusion.outcome) : null,
      defenseDate: historical.defenseDate,
      createdAt: historical.createdAt,
    };
    const currentAttempt = {
      scheduleId: current.id,
      defenseType: String(current.defenseType),
      defenseDate: current.defenseDate,
      createdAt: current.createdAt,
    };
    if (!historicalAttempt.outcome) return null;
    if (!isPriorAttempt(historicalAttempt, currentAttempt)) return null;
    return classifyHistoryRelationship(historicalAttempt, currentAttempt);
  }

  private resolveBoundManuscript(row: ScheduleRow): DefenseHistoryManuscriptDto | null {
    const boundId = row.manuscriptDocumentId ?? null;
    const bound = row.manuscriptDocument ?? null;
    if (!boundId || !bound) return null;
    // The bound id is authoritative ONLY when the included document matches it,
    // belongs to the same thesis, and matches the attempt's exact stage/type.
    if (bound.id !== boundId) return null;
    if (bound.thesisId !== row.thesisId) return null;
    const expectedStage = DEFENSE_TYPE_TO_DOCUMENT_STAGE[String(row.defenseType)] ?? null;
    if (!expectedStage) return null;
    if (String(bound.defenseStage ?? "") !== expectedStage) return null;
    if (!MANUSCRIPT_TYPE_BY_STAGE[expectedStage].includes(String(bound.docType))) return null;

    return {
      id: bound.id,
      docType: String(bound.docType),
      defenseStage: bound.defenseStage ? String(bound.defenseStage) : null,
      displayName: MANUSCRIPT_STAGE_LABEL[expectedStage],
      uploadedAt: iso(bound.uploadedAt),
    };
  }

  private toRapDto(row: ScheduleRow): DefenseHistoryRapDto | null {
    const rap = row.rapReports[0] ?? null;
    if (!rap) return null;
    // Only the authoritative FINALIZED RAP is official history. Draft/pending
    // content is never surfaced as if it were the committee record.
    if (String(rap.status) !== "FINALIZED") return null;

    const signatures = rap.signatures ?? [];
    const requiredSlots = signatures.filter((s) => s.required !== false);
    const signed = requiredSlots.filter((s) => s.isSigned === true).length;
    const bodyDocument =
      rap.bodyDocument !== null && typeof rap.bodyDocument === "object"
        ? rap.bodyDocument
        : null;

    return {
      id: rap.id,
      status: String(rap.status),
      finalizedAt: iso(rap.finalizedAt),
      bodyDocument,
      decisionsAndRecommendations: rap.decisionsAndRecommendations ?? null,
      isStructured: bodyDocument !== null,
      contentVersion: rap.contentVersion ?? null,
      signatureProgress: { required: requiredSlots.length, signed },
    };
  }

  private toBaseItem(
    row: ScheduleRow,
    relationship: DefenseHistoryRelationship,
  ): DefenseHistoryItemDto {
    const stage = DEFENSE_TYPE_TO_DOCUMENT_STAGE[String(row.defenseType)];
    return {
      scheduleId: row.id,
      defenseType: String(row.defenseType),
      stage,
      relationship,
      defenseDate: wallDate(row.defenseDate),
      defenseTime: wallTime(row.defenseTime),
      venueOrLink: row.venueOrLink ?? null,
      sessionStatus: String(row.sessionStatus),
      verdict: row.conclusion?.outcome ? String(row.conclusion.outcome) : null,
      concludedAt: iso(row.conclusion?.concludedAt ?? null),
      manuscript: this.resolveBoundManuscript(row),
      rapAvailable: String(row.rapReports[0]?.status ?? "") === "FINALIZED",
      annotationCount: row._count?.annotations ?? 0,
      commentCount: 0,
      committee: (row.panelAssignments ?? []).map((assignment) => ({
        userId: assignment.userId,
        name: personName(assignment.user),
        role: String(assignment.role),
      })),
    };
  }

  private async loadCommentCounts(scheduleIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (scheduleIds.length === 0) return counts;
    const rows = await prisma.defenseAnnotation.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: { scheduleId: true, _count: { select: { comments: true } } },
    });
    for (const row of rows) {
      counts.set(row.scheduleId, (counts.get(row.scheduleId) ?? 0) + (row._count?.comments ?? 0));
    }
    return counts;
  }
}
