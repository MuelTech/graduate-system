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
  resolveHistoryScheduleIds,
  type DefenseHistoryRelationship,
  type ResolvedHistoryItem,
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

/** Provenance of the historical Committee Report shown in history. */
export type DefenseHistoryReportSource =
  | "STRUCTURED_RAP"
  | "LEGACY_RAP_TEXT"
  | "LEGACY_RAPPORTEUR_NOTES";

export interface DefenseHistoryReportDto {
  /** Where this historical report content actually comes from. */
  source: DefenseHistoryReportSource;
  /** RapReport id when the content is a RapReport; null for schedule notes. */
  rapId: string | null;
  /** RapReport status ("FINALIZED") when applicable; null for schedule notes. */
  status: string | null;
  /** RAP finalizedAt, or the legacy notes' finalization timestamp. */
  finalizedAt: string | null;
  /** Explicit legacy-finalization timestamp (null when never recorded). */
  rapporteurNotesFinalizedAt: string | null;
  /** Canonical CDW-5 structured body — STRUCTURED_RAP only. */
  bodyDocument: unknown | null;
  /** Legacy text (RAP decisions/recommendations or Rapporteur notes). */
  text: string | null;
  contentVersion: number | null;
  /** Null for legacy Rapporteur notes: no signature lifecycle is fabricated. */
  signatureProgress: { required: number; signed: number } | null;
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
  /** Any usable historical report content exists (modern RAP or legacy notes). */
  reportAvailable: boolean;
  /** Provenance of that content; null when no historical report exists. */
  reportSource: DefenseHistoryReportSource | null;
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
  report: DefenseHistoryReportDto | null;
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

/** A string counts as report content only when it has non-whitespace text. */
function meaningfulText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** A structured canonical report body is a plain object (never an array/null). */
function isStructuredBody(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  rapporteurNotes: string | null;
  rapporteurNotesFinalizedAt: Date | null;
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
  rapporteurNotes: true,
  rapporteurNotesFinalizedAt: true,
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
    where: { isActive: true },
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

    const { ordered, byId } = await this.resolveHistoryForCurrent(current);
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
   * The SINGLE authoritative history resolution for a current schedule. Both the
   * list and the detail endpoint use this same set, so a schedule can never be
   * classified differently by the two endpoints. It also enforces the primary
   * normalization (at most one same-stage re-defense / one previous stage).
   */
  private async resolveHistoryForCurrent(current: {
    id: string;
    thesisId: string;
    defenseType: unknown;
    defenseDate: Date;
    createdAt: Date;
  }): Promise<{ ordered: ResolvedHistoryItem[]; byId: Map<string, ScheduleRow> }> {
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

    return {
      ordered,
      byId: new Map(candidates.map((row) => [row.id, row])),
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

    // ONE authoritative resolution: the same normalized set the list returns.
    // The detail NEVER re-derives a relationship from just two attempts, which
    // would ignore a newer primary elsewhere in the history.
    const { ordered } = await this.resolveHistoryForCurrent(current);
    const resolved = ordered.find((item) => item.scheduleId === historicalScheduleId);
    if (!resolved) {
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
      ...this.toBaseItem(historical, resolved.relationship),
      annotationCount: historical._count?.annotations ?? 0,
      commentCount,
      manuscript,
      report: this.resolveHistoricalReport(historical),
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
      where: { scheduleId, userId, isActive: true },
      select: { id: true },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
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

  /**
   * CDW-6 correction — resolve the historical report honestly, with explicit
   * provenance. Precedence:
   *  1. FINALIZED RapReport with a structured body → STRUCTURED_RAP;
   *  2. FINALIZED RapReport with legacy text        → LEGACY_RAP_TEXT;
   *  3. no usable FINALIZED RapReport + meaningful schedule notes
   *                                                 → LEGACY_RAPPORTEUR_NOTES;
   *  4. otherwise                                    → null.
   *
   * A DRAFT/pending modern RapReport is NEVER surfaced as official history. A
   * RapReport row and structured JSON are never fabricated for legacy attempts,
   * and legacy notes carry no signature progress.
   */
  private resolveHistoricalReport(row: ScheduleRow): DefenseHistoryReportDto | null {
    const rap = row.rapReports[0] ?? null;
    const notesFinalizedAt = iso(row.rapporteurNotesFinalizedAt);

    if (rap && String(rap.status) === "FINALIZED") {
      const signatures = rap.signatures ?? [];
      const requiredSlots = signatures.filter((s) => s.required !== false);
      const signatureProgress = {
        required: requiredSlots.length,
        signed: requiredSlots.filter((s) => s.isSigned === true).length,
      };
      const bodyDocument = isStructuredBody(rap.bodyDocument) ? rap.bodyDocument : null;

      if (bodyDocument !== null) {
        return {
          source: "STRUCTURED_RAP",
          rapId: rap.id,
          status: "FINALIZED",
          finalizedAt: iso(rap.finalizedAt),
          rapporteurNotesFinalizedAt: notesFinalizedAt,
          bodyDocument,
          text: null,
          contentVersion: rap.contentVersion ?? null,
          signatureProgress,
        };
      }

      const legacyText = meaningfulText(rap.decisionsAndRecommendations);
      if (legacyText) {
        return {
          source: "LEGACY_RAP_TEXT",
          rapId: rap.id,
          status: "FINALIZED",
          finalizedAt: iso(rap.finalizedAt),
          rapporteurNotesFinalizedAt: notesFinalizedAt,
          bodyDocument: null,
          text: legacyText,
          contentVersion: rap.contentVersion ?? null,
          signatureProgress,
        };
      }
      // FINALIZED but empty → fall through to schedule notes below.
    }

    const notes = meaningfulText(row.rapporteurNotes);
    if (notes) {
      return {
        source: "LEGACY_RAPPORTEUR_NOTES",
        rapId: null,
        // Not a modern signed/finalized RAP: provenance is the legacy notes.
        status: null,
        finalizedAt: notesFinalizedAt,
        rapporteurNotesFinalizedAt: notesFinalizedAt,
        bodyDocument: null,
        text: notes,
        contentVersion: null,
        signatureProgress: null,
      };
    }

    return null;
  }

  private toBaseItem(
    row: ScheduleRow,
    relationship: DefenseHistoryRelationship,
  ): DefenseHistoryItemDto {
    const stage = DEFENSE_TYPE_TO_DOCUMENT_STAGE[String(row.defenseType)];
    const report = this.resolveHistoricalReport(row);
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
      reportAvailable: report !== null,
      reportSource: report?.source ?? null,
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
