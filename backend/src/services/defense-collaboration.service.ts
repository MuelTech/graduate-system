/**
 * CDW-1 — collaborative Defense Workspace foundation (server-authoritative).
 *
 * Provides the authorization + persistence foundation for manuscript annotations,
 * comment threads, the Rapporteur Committee Report body, report freeze/hash, and
 * a read-only conclusion-readiness model.
 *
 * This is NOT the collaborative UI (CDW-2/CDW-3/CDW-5). It owns the Rapporteur
 * report read model, draft, and freeze, the RAP-C1 signing lifecycle, and the
 * read-only conclusion-readiness facts. The in-system report is the official RAP
 * source: it must be authored, frozen, and fully signed (FINALIZED) BEFORE the
 * Chairman may record the verdict; the conclusion path never creates a RAP.
 *
 * Security model (fail closed):
 *  - authority comes from the caller's PanelAssignment for the exact schedule,
 *    never from an account-level role or a client-supplied assignment id;
 *  - the target document must belong to the exact attempt/stage/current slot;
 *  - concluded/frozen/cancelled attempts reject writes.
 */
import type { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  type AnchorPayload,
  validateAnchorPayload,
} from "./anchor-validation.rules";
import {
  type CanonicalReportDocument,
  canonicalizeReportDocument,
  hasMeaningfulReportContent,
  validateReportDocument,
} from "./report-body.rules";
import {
  FROZEN_REPORT_STATUSES,
  isCollaborationWritableStatus,
  isReportBodyEditable,
  isReportFinalizationStatus,
} from "./report-edit-authority.rules";
import {
  type RapSnapshotCommitteeMember,
  buildRapSigningSnapshot,
  hashRapSnapshot,
} from "./rap-snapshot.rules";
import {
  resolveRapSignatureRequirements,
} from "./rap-signature.policy";
import { RapReportService } from "./rap-report.service";
import {
  DEFENSE_AUDIT_ACTIONS,
  DEFENSE_AUDIT_TARGETS,
  writeDefenseAudit,
} from "./defense-audit";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import {
  selectCertifiedFinalManuscript,
  selectCertifiedProposalManuscript,
} from "./proposal-adviser-review.rules";

const ANNOTATION_WRITE_ROLES = ["CHAIRMAN", "PANELIST"];
const COMMENT_WRITE_ROLES = ["CHAIRMAN", "PANELIST", "RAPPORTEUR"];
const RAPPORTEUR_ROLE = "RAPPORTEUR";
const CHAIRMAN_ROLE = "CHAIRMAN";
const MAX_COMMENT_LENGTH = 5000;
const SIGNATURE_EVIDENCE_PREFIX = "data:image/";

/**
 * RAP-C1 signature evidence guard. Reuses the existing project e-signature
 * convention (image data URL) without inventing a new raw-signature model.
 */
function normalizeSignatureEvidence(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("Signature evidence is required.", 400);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new AppError("Signature evidence is required.", 400);
  if (!trimmed.startsWith(SIGNATURE_EVIDENCE_PREFIX)) {
    throw new AppError("Signature must be image evidence (data:image/...).", 400);
  }
  return trimmed;
}

/**
 * A Prisma transaction client (also satisfied by the shared client). Key
 * resolution helpers accept this so the exact same authorization logic runs on
 * the locked transaction client (never duplicated for transactions).
 */
type DbClient = Prisma.TransactionClient;

/** Exact stage/document binding per defense stage (prevents cross-stage injection). */
const STAGE_DOC_BINDING: Record<string, { stage: string; docTypes: string[] }> = {
  TITLE_DEFENSE: { stage: "TITLE", docTypes: ["TITLE_PROPOSAL"] },
  PROPOSAL_DEFENSE: { stage: "PROPOSAL", docTypes: ["PROPOSAL_CHAPTERS"] },
  FINAL_DEFENSE: { stage: "FINAL", docTypes: ["FINAL_MANUSCRIPT"] },
};

/** Single source of truth for whether collaboration writes are open lives in
 * `report-edit-authority.rules.ts` and is shared with the live-preview transport. */

/**
 * CDW-3: validate an optional initial comment supplied with a new annotation.
 * Returns the trimmed body, or null when absent. Fails closed on a non-string,
 * empty/whitespace, or over-length value (same limit as the reply endpoint).
 */
function normalizeInitialComment(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError("Comment body is required.", 400);
  }
  const body = value.trim();
  if (!body) throw new AppError("Comment body is required.", 400);
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new AppError("Comment is too long.", 400);
  }
  return body;
}

export interface CollaborationAuthor {
  assignmentId: string;
  userId: string;
  name: string;
  role: string;
}

export interface AnnotationCommentDto {
  id: string;
  annotationId: string;
  parentCommentId: string | null;
  body: string;
  author: CollaborationAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationDto {
  id: string;
  scheduleId: string;
  thesisDocumentId: string;
  pageNumber: number;
  selectedText: string;
  anchor: AnchorPayload;
  author: CollaborationAuthor;
  createdAt: string;
  updatedAt: string;
  comments: AnnotationCommentDto[];
}

export interface ReportReadModel {
  scheduleId: string;
  defenseType: string;
  sessionStatus: string;
  reportId: string | null;
  studentName: string;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  reportDate: string | null;
  venue: string | null;
  reportStatus: string;
  bodyVersion: number;
  contentVersion: number;
  body: CanonicalReportDocument | null;
  hasCollaborativeBody: boolean;
  legacyContent: {
    decisionsAndRecommendations: string | null;
    rapporteurNotes: string | null;
  };
  freeze: {
    frozenAt: string | null;
    frozenById: string | null;
    frozenContentHash: string | null;
  };
  canEditBody: boolean;
  /** RAP-C1: assigned Rapporteur may freeze a content-complete DRAFT. */
  canFreeze: boolean;
  /** RAP-C1: human-readable freeze preconditions (authoritative server facts). */
  freezeReadiness: {
    ready: boolean;
    checks: FreezeReadinessCheck[];
  };
  /** RAP-C1: required signer roster + status (never raw signature evidence). */
  signatures: ReportSignerDto[];
  signatureProgress: ReportSignatureProgress;
  /** RAP-C1: the caller's own required slot, or null when not a signer. */
  mySignature: ReportSignerDto | null;
  /** RAP-C1: the caller may sign the exact frozen artifact now. */
  canSign: boolean;
}

export interface FreezeReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface ReportSignerDto {
  userId: string;
  name: string;
  roleAtDefense: string;
  required: boolean;
  isSigned: boolean;
  signedAt: string | null;
}

export interface ReportSignatureProgress {
  required: number;
  signed: number;
}

export interface ConclusionReadiness {
  scheduleId: string;
  defenseType: string;
  sessionStatus: string;
  isChairman: boolean;
  concluded: boolean;
  evaluatorAssignments: number;
  finalizedEvaluations: number;
  allEvaluationsFinalized: boolean;
  oralSummaryExists: boolean;
  reportExists: boolean;
  reportFrozen: boolean;
  reportFinalized: boolean;
  requiredSignatures: number;
  signedSignatures: number;
  allSignaturesSigned: boolean;
  blockers: string[];
  readyForConclusion: boolean;
}

type AssignmentWithUser = {
  id: string;
  userId: string;
  role: unknown;
  user?: { firstName: string | null; lastName: string | null } | null;
};

type AnnotationRow = {
  id: string;
  scheduleId: string;
  thesisDocumentId: string;
  pageNumber: number;
  selectedText: string;
  anchorData: unknown;
  anchorVersion: number;
  createdAt: Date;
  updatedAt: Date;
  author: AssignmentWithUser;
};

type CommentRow = {
  id: string;
  annotationId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: AssignmentWithUser;
};

function authorName(assignment: AssignmentWithUser): string {
  const user = assignment.user ?? null;
  if (!user) return "";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

function toAuthor(assignment: AssignmentWithUser): CollaborationAuthor {
  return {
    assignmentId: assignment.id,
    userId: assignment.userId,
    name: authorName(assignment),
    role: String(assignment.role),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildAnchorFromRow(row: AnnotationRow): AnchorPayload {
  const data = asRecord(row.anchorData);
  return {
    anchorVersion: row.anchorVersion,
    pageNumber: row.pageNumber,
    selectedText: row.selectedText,
    rects: Array.isArray(data.rects) ? (data.rects as AnchorPayload["rects"]) : [],
    prefix: typeof data.prefix === "string" ? data.prefix : "",
    suffix: typeof data.suffix === "string" ? data.suffix : "",
  };
}

function toCommentDto(row: CommentRow): AnnotationCommentDto {
  return {
    id: row.id,
    annotationId: row.annotationId,
    parentCommentId: row.parentCommentId,
    body: row.body,
    author: toAuthor(row.author),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAnnotationDto(row: AnnotationRow, comments: CommentRow[]): AnnotationDto {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    thesisDocumentId: row.thesisDocumentId,
    pageNumber: row.pageNumber,
    selectedText: row.selectedText,
    anchor: buildAnchorFromRow(row),
    author: toAuthor(row.author),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    comments: comments.map(toCommentDto),
  };
}

export class DefenseCollaborationService {
  private rapService = new RapReportService();

  /**
   * Load a schedule and its (single) RAP report. Throws 404 when missing.
   * `rap` is null when no report row exists yet for the attempt.
   */
  private async loadSchedule(scheduleId: string, db: DbClient = prisma) {
    const schedule = await db.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        rapReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            signatures: {
              orderBy: { createdAt: "asc" },
              select: {
                userId: true,
                roleAtDefense: true,
                required: true,
                isSigned: true,
                signedAt: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        panelAssignments: {
          where: { isActive: true },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        oralExamScores: { select: { panelId: true, status: true } },
        oralExamSummary: { select: { id: true } },
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    return { schedule, rap: schedule.rapReports[0] ?? null };
  }

  /**
   * Load the fixed institutional metadata needed for the complete signing
   * snapshot (student/program identity, schedule, committee roster, prepared-by).
   * The report body itself comes from the RapReport being frozen.
   */
  private async loadFreezeContext(
    scheduleId: string,
    rapporteurUserId: string,
    db: DbClient = prisma,
  ) {
    const schedule = await db.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        panelAssignments: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const student = schedule.thesis?.student;
    const studentName = student
      ? `${student.user?.firstName ?? ""} ${student.user?.lastName ?? ""}`.trim()
      : "";
    const committee: RapSnapshotCommitteeMember[] = schedule.panelAssignments.map((pa) => ({
      role: String(pa.role),
      userId: pa.userId,
      name: `${pa.user?.firstName ?? ""} ${pa.user?.lastName ?? ""}`.trim(),
    }));

    return {
      thesisId: schedule.thesisId,
      defenseType: String(schedule.defenseType),
      studentName,
      studentNumber: student?.studentNumber ?? null,
      programName: student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate ? schedule.defenseDate.toISOString() : null,
      defenseTime: schedule.defenseTime ? schedule.defenseTime.toISOString() : null,
      venue: schedule.venueOrLink ?? null,
      committee,
      preparedByName: committee.find((c) => c.userId === rapporteurUserId)?.name ?? null,
    };
  }

  /** Authority comes from the caller's own assignment for the exact schedule. */
  private async resolveAssignment(scheduleId: string, userId: string, db: DbClient = prisma) {
    const assignment = await db.panelAssignment.findFirst({
      where: { scheduleId, userId, isActive: true },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
    return assignment;
  }

  /**
   * Serialize the write decision + write against the RAP freeze boundary for ONE
   * attempt. Locks the exact DefenseSchedule row (`SELECT ... FOR UPDATE`) and
   * runs the callback on the transaction client, so annotation creation,
   * comment/reply creation, and RAP freeze all share a single lock authority and
   * order (schedule → RAP). A collaboration write therefore cannot observe a
   * pre-freeze DRAFT and commit after the freeze has won.
   */
  private async withAttemptLock<T>(
    scheduleId: string,
    fn: (tx: DbClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT schedule_id FROM defense_schedules WHERE schedule_id = ${scheduleId} FOR UPDATE`;
      return fn(tx);
    });
  }

  /**
   * LIVE WRITE authority. Prove the target document is the exact authoritative
   * manuscript for the live attempt:
   *  - TITLE_DEFENSE: the current authoritative Title Proposal package;
   *  - PROPOSAL/FINAL: the exact ISSUED AdviserCertification.reviewedDocumentId
   *    (the certified manuscript is authoritative — `isCurrent` is NOT authority).
   * Fails closed; never substitutes a newer/latest/current manuscript.
   */
  private async resolveLiveWriteDocument(
    schedule: { thesisId: string; defenseType: unknown; manuscriptDocumentId?: string | null },
    thesisDocumentId: string,
    db: DbClient = prisma,
  ) {
    const defenseType = String(schedule.defenseType);
    const binding = STAGE_DOC_BINDING[defenseType];
    if (!binding) {
      throw new AppError("Collaboration is not supported for this defense type.", 400);
    }
    const document = await db.thesisDocument.findUnique({
      where: { id: thesisDocumentId },
    });
    if (!document) throw new AppError("Defense document not found.", 404);
    if (document.thesisId !== schedule.thesisId) {
      throw new AppError("Document does not belong to this defense attempt.", 403);
    }
    if (String(document.defenseStage ?? "") !== binding.stage) {
      throw new AppError("Document does not belong to this defense stage.", 403);
    }
    if (!binding.docTypes.includes(String(document.docType))) {
      throw new AppError("Document is not an authorized defense manuscript.", 403);
    }

    // CDW-2 correction: once an attempt is bound, the SCHEDULE binding is the
    // attempt authority. A later upload / certification rebind / isCurrent change
    // must never switch the annotatable manuscript.
    const boundDocumentId = schedule.manuscriptDocumentId ?? null;
    if (boundDocumentId) {
      if (document.id !== boundDocumentId) {
        throw new AppError(
          "Only the manuscript bound to this defense attempt can be annotated.",
          409,
        );
      }
      return document;
    }

    if (defenseType === "TITLE_DEFENSE") {
      const authoritative = await db.thesisDocument.findFirst({
        where: {
          thesisId: schedule.thesisId,
          docType: "TITLE_PROPOSAL",
          OR: [{ defenseStage: "TITLE" }, { defenseStage: null }],
        },
        orderBy: { uploadedAt: "desc" },
        select: { id: true },
      });
      if (!authoritative || authoritative.id !== document.id || document.isCurrent !== true) {
        throw new AppError("Only the current Title Proposal package can be annotated.", 409);
      }
      return document;
    }

    const cert = await db.adviserCertification.findFirst({
      where: {
        thesisId: schedule.thesisId,
        defenseStage: defenseType as never,
        status: "ISSUED",
      },
      select: { status: true, defenseStage: true, reviewedDocumentId: true },
    });
    const docLike = {
      id: document.id,
      thesisId: document.thesisId,
      docType: String(document.docType),
      defenseStage: document.defenseStage ?? null,
    };
    const certified =
      defenseType === "PROPOSAL_DEFENSE"
        ? selectCertifiedProposalManuscript([docLike], cert, schedule.thesisId)
        : selectCertifiedFinalManuscript([docLike], cert, schedule.thesisId);
    if (!certified) {
      throw new AppError("Only the certified defense manuscript can be annotated.", 409);
    }
    return document;
  }

  /**
   * HISTORICAL / READ authority. Existing annotations for an attempt must remain
   * readable even after their manuscript is superseded, so this verifies only the
   * same thesis + valid stage/docType — NEVER `isCurrent` and NEVER certification.
   * Reads are additionally scoped by BOTH scheduleId and thesisDocumentId.
   */
  private async resolveReadableDocument(
    schedule: { thesisId: string; defenseType: unknown },
    thesisDocumentId: string,
    db: DbClient = prisma,
  ) {
    const binding = STAGE_DOC_BINDING[String(schedule.defenseType)];
    if (!binding) {
      throw new AppError("Collaboration is not supported for this defense type.", 400);
    }
    const document = await db.thesisDocument.findUnique({
      where: { id: thesisDocumentId },
    });
    if (!document) throw new AppError("Defense document not found.", 404);
    if (document.thesisId !== schedule.thesisId) {
      throw new AppError("Document does not belong to this defense attempt.", 403);
    }
    if (String(document.defenseStage ?? "") !== binding.stage) {
      throw new AppError("Document does not belong to this defense stage.", 403);
    }
    if (!binding.docTypes.includes(String(document.docType))) {
      throw new AppError("Document is not an authorized defense manuscript.", 403);
    }
    return document;
  }

  private assertSessionOpen(sessionStatus: unknown): void {
    const status = String(sessionStatus);
    if (status === "CONCLUDED") {
      throw new AppError("This defense attempt is concluded and is read-only.", 409);
    }
    if (status === "CANCELLED") {
      throw new AppError("This defense session was cancelled.", 409);
    }
    if (!isCollaborationWritableStatus(status)) {
      throw new AppError("Collaboration is not open for this defense session.", 409);
    }
  }

  /**
   * FIX-6: Committee Report finalization/signing is independent of evaluation
   * completion, but it still belongs to the active defense lifecycle. SCHEDULED
   * is pre-defense review/authoring only.
   */
  private assertReportFinalizationOpen(sessionStatus: unknown): void {
    if (!isReportFinalizationStatus(String(sessionStatus))) {
      throw new AppError(
        "Committee Report finalization and signing are not open for this defense session.",
        409,
      );
    }
  }

  private assertCollaborationWritable(
    schedule: { sessionStatus: unknown },
    rap: { status: unknown; frozenAt: Date | null } | null,
  ): void {
    this.assertSessionOpen(schedule.sessionStatus);
    if (rap && (rap.frozenAt || (FROZEN_REPORT_STATUSES as readonly string[]).includes(String(rap.status)))) {
      throw new AppError(
        "The Committee Report is finalized for signatures; collaboration is read-only.",
        409,
      );
    }
  }

  // ---- Annotations -------------------------------------------------------

  async listAnnotations(
    scheduleId: string,
    userId: string,
    thesisDocumentId: string,
  ): Promise<AnnotationDto[]> {
    if (!thesisDocumentId) throw new AppError("A defense document is required.", 400);
    const { schedule } = await this.loadSchedule(scheduleId);
    await this.resolveAssignment(scheduleId, userId);
    await this.resolveReadableDocument(schedule, thesisDocumentId);
    return this.listAttemptAnnotationsForHistory(scheduleId, thesisDocumentId);
  }

  /**
   * CDW-6: read-only annotation/comment read for an EXACT attempt + document.
   *
   * There is NO authorization here by design: `listAnnotations` runs its own
   * live-read proof before calling this, and `DefenseHistoryService` proves
   * current-assignment historical authority before calling it. Keeping the read
   * shape in one place means the current workspace and historical history can
   * never diverge. Never a write path; always scoped by BOTH scheduleId and the
   * exact thesisDocumentId, so annotations never mix across attempts/documents.
   */
  async listAttemptAnnotationsForHistory(
    scheduleId: string,
    thesisDocumentId: string,
    db: DbClient = prisma,
  ): Promise<AnnotationDto[]> {
    const rows = await db.defenseAnnotation.findMany({
      where: { scheduleId, thesisDocumentId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { include: { user: { select: { firstName: true, lastName: true } } } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    return rows.map((row) => toAnnotationDto(row as AnnotationRow, (row.comments ?? []) as CommentRow[]));
  }

  async createAnnotation(
    scheduleId: string,
    userId: string,
    input: { thesisDocumentId?: unknown; anchor?: unknown; initialComment?: unknown },
  ): Promise<AnnotationDto> {
    const thesisDocumentId =
      typeof input.thesisDocumentId === "string" ? input.thesisDocumentId : "";
    if (!thesisDocumentId) throw new AppError("A defense document is required.", 400);

    // CDW-3: the canonical "highlight + initial comment" action is validated up
    // front so a rejected comment never leaves an orphan published annotation.
    const initialComment = normalizeInitialComment(input.initialComment);
    const validation = validateAnchorPayload(input.anchor);
    if (!validation.ok) throw new AppError(validation.error, 400);
    const anchor = validation.anchor;

    // The write decision (writable state) and the write are serialized on the
    // per-attempt lock so a freeze that wins the race rejects this annotation.
    return this.withAttemptLock(scheduleId, async (tx) => {
      const { schedule, rap } = await this.loadSchedule(scheduleId, tx);
      const assignment = await this.resolveAssignment(scheduleId, userId, tx);
      if (!ANNOTATION_WRITE_ROLES.includes(String(assignment.role))) {
        throw new AppError("Your defense role cannot create annotations.", 403);
      }
      this.assertCollaborationWritable(schedule, rap);
      const document = await this.resolveLiveWriteDocument(schedule, thesisDocumentId, tx);

      // Single nested write: the annotation and its initial comment commit together
      // or not at all (no two-request window that could strand an empty highlight).
      const created = await tx.defenseAnnotation.create({
        data: {
          scheduleId,
          thesisDocumentId: document.id,
          authorAssignmentId: assignment.id,
          pageNumber: anchor.pageNumber,
          selectedText: anchor.selectedText,
          anchorData: {
            rects: anchor.rects,
            prefix: anchor.prefix,
            suffix: anchor.suffix,
          } as never,
          anchorVersion: anchor.anchorVersion,
          ...(initialComment
            ? { comments: { create: { authorAssignmentId: assignment.id, body: initialComment } } }
            : {}),
        },
        include: {
          author: { include: { user: { select: { firstName: true, lastName: true } } } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      });
      const createdComments = Array.isArray((created as { comments?: unknown }).comments)
        ? ((created as { comments: CommentRow[] }).comments)
        : [];
      return toAnnotationDto(created as AnnotationRow, createdComments);
    });
  }

  async createComment(
    scheduleId: string,
    userId: string,
    input: { annotationId?: unknown; body?: unknown; parentCommentId?: unknown },
  ): Promise<{ comment: AnnotationCommentDto; thesisDocumentId: string }> {
    const annotationId =
      typeof input.annotationId === "string" ? input.annotationId : "";
    if (!annotationId) throw new AppError("An annotation is required.", 400);
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!body) throw new AppError("Comment body is required.", 400);
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new AppError("Comment is too long.", 400);
    }
    const rawParentCommentId = input.parentCommentId;
    if (
      rawParentCommentId !== undefined &&
      rawParentCommentId !== null &&
      typeof rawParentCommentId !== "string"
    ) {
      throw new AppError("parentCommentId must be a string.", 400);
    }
    const parentCommentId =
      typeof rawParentCommentId === "string" && rawParentCommentId.trim()
        ? rawParentCommentId.trim()
        : null;

    // Serialize the writable-state check + insert with RAP freeze: if a freeze
    // wins the lock first, this transaction re-reads the frozen RAP and rejects.
    return this.withAttemptLock(scheduleId, async (tx) => {
      const { schedule, rap } = await this.loadSchedule(scheduleId, tx);
      const assignment = await this.resolveAssignment(scheduleId, userId, tx);
      if (!COMMENT_WRITE_ROLES.includes(String(assignment.role))) {
        throw new AppError("Your defense role cannot comment on annotations.", 403);
      }
      this.assertCollaborationWritable(schedule, rap);

      const annotation = await tx.defenseAnnotation.findUnique({
        where: { id: annotationId },
        select: { id: true, scheduleId: true, thesisDocumentId: true },
      });
      if (!annotation) throw new AppError("Annotation not found.", 404);
      if (annotation.scheduleId !== scheduleId) {
        throw new AppError("Annotation belongs to another defense attempt.", 403);
      }

      if (parentCommentId) {
        const parent = await tx.defenseAnnotationComment.findUnique({
          where: { id: parentCommentId },
          select: { id: true, annotationId: true, parentCommentId: true },
        });
        if (!parent) throw new AppError("Parent comment not found.", 404);
        if (parent.annotationId !== annotationId) {
          throw new AppError("Parent comment belongs to a different annotation.", 400);
        }
        if (parent.parentCommentId) {
          throw new AppError("Replies support only one level of nesting.", 400);
        }
      }

      const created = await tx.defenseAnnotationComment.create({
        data: { annotationId, authorAssignmentId: assignment.id, body, parentCommentId },
        include: {
          author: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });
      return {
        comment: toCommentDto(created as CommentRow),
        thesisDocumentId: annotation.thesisDocumentId,
      };
    });
  }

  // ---- Committee Report --------------------------------------------------

  async getReportReadModel(scheduleId: string, userId: string): Promise<ReportReadModel> {
    const { schedule, rap } = await this.loadSchedule(scheduleId);
    // The exact roster is already part of the attempt snapshot. Resolve the
    // caller's assignment from it rather than re-querying the same assignment.
    const assignment = schedule.panelAssignments.find(
      (candidate) => candidate.userId === userId,
    );
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
    const reportStatus = rap ? String(rap.status) : "NOT_CREATED";
    const body = (rap?.bodyDocument ?? null) as CanonicalReportDocument | null;
    const student = schedule.thesis?.student;
    const studentName = student
      ? `${student.user?.firstName ?? ""} ${student.user?.lastName ?? ""}`.trim()
      : "";

    const freezeReadiness = this.computeFreezeReadiness(schedule, rap, assignment.role);
    const signatureState = this.buildSignatureState(schedule, rap, userId);

    return {
      scheduleId,
      defenseType: String(schedule.defenseType),
      sessionStatus: String(schedule.sessionStatus),
      reportId: rap?.id ?? null,
      studentName,
      studentNumber: student?.studentNumber ?? null,
      program: student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate
        ? new Date(schedule.defenseDate).toISOString()
        : null,
      reportDate: rap?.reportDate ? rap.reportDate.toISOString() : null,
      venue: rap?.venue ?? null,
      reportStatus,
      bodyVersion: rap?.bodyVersion ?? 0,
      contentVersion: rap?.contentVersion ?? 0,
      body,
      hasCollaborativeBody: body !== null,
      legacyContent: {
        decisionsAndRecommendations: rap?.decisionsAndRecommendations ?? null,
        rapporteurNotes: schedule.rapporteurNotes ?? null,
      },
      freeze: {
        frozenAt: rap?.frozenAt ? rap.frozenAt.toISOString() : null,
        frozenById: rap?.frozenById ?? null,
        frozenContentHash: rap?.frozenContentHash ?? null,
      },
      canEditBody: this.computeCanEditBody(schedule, rap, assignment.role),
      canFreeze: freezeReadiness.ready,
      freezeReadiness,
      signatures: signatureState.signatures,
      signatureProgress: signatureState.signatureProgress,
      mySignature: signatureState.mySignature,
      canSign: signatureState.canSign,
    };
  }

  /**
   * Single shared rule for report-body write eligibility, used by BOTH the read
   * model (`canEditBody`) and the write paths: assigned Rapporteur, session in a
   * writable status, and either no report exists yet (CDW-5 authoring draft is
   * created on first save) or the report is an unfrozen DRAFT.
   */
  private computeCanEditBody(
    schedule: { sessionStatus: unknown },
    rap: { status: unknown; frozenAt: Date | null } | null,
    role: unknown,
  ): boolean {
    return isReportBodyEditable({
      sessionStatus: String(schedule.sessionStatus),
      role: role === null || role === undefined ? null : String(role),
      rapStatus: rap ? String(rap.status) : null,
      rapFrozenAt: rap?.frozenAt ?? null,
    });
  }

  /**
   * FIX-6 finalization preconditions. Report content and exact Rapporteur
   * authority are the only readiness facts; evaluator/Summary completion is
   * intentionally NOT part of this decision.
   */
  private computeFreezeReadiness(
    schedule: { sessionStatus: unknown },
    rap: { status: unknown; frozenAt: Date | null; bodyDocument: unknown } | null,
    role: unknown,
  ): { ready: boolean; checks: FreezeReadinessCheck[] } {
    const body = rap?.bodyDocument ?? null;
    const checks: FreezeReadinessCheck[] = [
      {
        key: "content",
        label: "Committee Report contains content",
        ok: body !== null && hasMeaningfulReportContent(body),
      },
    ];

    const eligible =
      String(role) === RAPPORTEUR_ROLE &&
      isReportFinalizationStatus(String(schedule.sessionStatus)) &&
      rap !== null &&
      String(rap.status) === "DRAFT" &&
      !rap.frozenAt;

    return { ready: eligible && checks.every((c) => c.ok), checks };
  }

  /**
   * RAP-C1 signature roster + caller state. Exposes ONLY status metadata — never
   * raw signatureData / images.
   */
  private buildSignatureState(
    schedule: { sessionStatus: unknown },
    rap: {
      status: unknown;
      frozenAt: Date | null;
      frozenContentHash: string | null;
      signatures?: Array<{
        userId: string;
        roleAtDefense: string | null;
        required: boolean | null;
        isSigned: boolean | null;
        signedAt: Date | null;
        user?: { firstName: string | null; lastName: string | null } | null;
      }>;
    } | null,
    userId: string,
  ) {
    const rows = rap?.signatures ?? [];
    const signatures: ReportSignerDto[] = rows.map((s) => ({
      userId: s.userId,
      name: `${s.user?.firstName ?? ""} ${s.user?.lastName ?? ""}`.trim(),
      roleAtDefense: String(s.roleAtDefense ?? ""),
      required: s.required !== false,
      isSigned: s.isSigned === true,
      signedAt: s.signedAt ? s.signedAt.toISOString() : null,
    }));
    const requiredSlots = signatures.filter((s) => s.required);
    const signedSlots = requiredSlots.filter((s) => s.isSigned);
    const mySignature = signatures.find((s) => s.userId === userId) ?? null;
    const signableStatus =
      String(rap?.status) === "FOR_SIGNATURE" || String(rap?.status) === "PARTIALLY_SIGNED";
    const canSign =
      Boolean(rap?.frozenAt) &&
      Boolean(rap?.frozenContentHash) &&
      signableStatus &&
      isReportFinalizationStatus(String(schedule.sessionStatus)) &&
      mySignature !== null &&
      mySignature.required &&
      !mySignature.isSigned;
    return {
      signatures,
      signatureProgress: { required: requiredSlots.length, signed: signedSlots.length },
      mySignature,
      canSign,
    };
  }

  async saveReportDraft(
    scheduleId: string,
    userId: string,
    body: unknown,
    expectedBodyVersion?: number | null,
  ): Promise<{ saved: true; bodyVersion: number; reportId: string }> {
    const { schedule, rap } = await this.loadSchedule(scheduleId);
    const assignment = await this.resolveAssignment(scheduleId, userId);
    if (String(assignment.role) !== RAPPORTEUR_ROLE) {
      throw new AppError("Only the assigned Rapporteur may edit the committee report.", 403);
    }
    this.assertSessionOpen(String(schedule.sessionStatus));

    const validation = validateReportDocument(body);
    if (!validation.ok) throw new AppError(validation.error, 400);
    const canonical = canonicalizeReportDocument(body);
    const now = new Date();

    // Existing report: must be an unfrozen DRAFT (otherwise immutable / closed).
    if (rap) {
      if (rap.frozenAt || String(rap.status) !== "DRAFT") {
        throw new AppError("The Committee Report is finalized and can no longer be edited.", 409);
      }
      return this.applyReportDraftUpdate(
        rap.id,
        canonical,
        now,
        expectedBodyVersion,
        rap.bodyVersion ?? 0,
      );
    }

    // CDW-5: the assigned Rapporteur's first save creates the authoring DRAFT for
    // the exact attempt. Deliberately NO signature slots and no status transition
    // beyond DRAFT — freeze + signing belong to RAP-C1.
    try {
      const created = await prisma.rapReport.create({
        data: {
          scheduleId,
          thesisId: schedule.thesisId,
          defenseType: schedule.defenseType,
          venue: schedule.venueOrLink ?? null,
          status: "DRAFT",
          bodyDocument: canonical as never,
          bodyVersion: 1,
          bodyUpdatedAt: now,
        },
        select: { id: true, bodyVersion: true },
      });
      return { saved: true, bodyVersion: created.bodyVersion, reportId: created.id };
    } catch (error) {
      // Concurrent first save: the unique (scheduleId) row already exists. Reuse
      // it and apply the same versioned write instead of losing the draft.
      if ((error as { code?: string })?.code !== "P2002") throw error;
      const existing = await prisma.rapReport.findUnique({
        where: { scheduleId },
        select: { id: true, status: true, frozenAt: true, bodyVersion: true },
      });
      if (!existing) throw error;
      if (existing.frozenAt || String(existing.status) !== "DRAFT") {
        throw new AppError("The Committee Report is finalized and can no longer be edited.", 409);
      }
      return this.applyReportDraftUpdate(
        existing.id,
        canonical,
        now,
        expectedBodyVersion,
        existing.bodyVersion ?? 0,
      );
    }
  }

  /**
   * Versioned DRAFT write. When `expectedBodyVersion` is supplied the update is a
   * CAS: a stale client can never silently overwrite a newer server draft (409).
   */
  private async applyReportDraftUpdate(
    rapId: string,
    canonical: CanonicalReportDocument,
    now: Date,
    expectedBodyVersion: number | null | undefined,
    currentBodyVersion: number,
  ): Promise<{ saved: true; bodyVersion: number; reportId: string }> {
    const where: Record<string, unknown> = { id: rapId, status: "DRAFT", frozenAt: null };
    if (expectedBodyVersion !== null && expectedBodyVersion !== undefined) {
      where.bodyVersion = expectedBodyVersion;
    }
    const updated = await prisma.rapReport.updateMany({
      where: where as never,
      data: {
        bodyDocument: canonical as never,
        bodyVersion: { increment: 1 },
        bodyUpdatedAt: now,
      },
    });
    if (updated.count === 0) {
      throw new AppError("Report changed. Refresh and review the latest version.", 409);
    }
    const refreshed = await prisma.rapReport.findUnique({
      where: { id: rapId },
      select: { bodyVersion: true },
    });
    return {
      saved: true,
      bodyVersion: refreshed?.bodyVersion ?? currentBodyVersion + 1,
      reportId: rapId,
    };
  }

  async freezeReportForSignatures(
    scheduleId: string,
    userId: string,
    expectedBodyVersion?: number | null,
  ): Promise<{
    frozen: true;
    alreadyFrozen: boolean;
    reportId: string;
    contentVersion: number;
    contentHash: string;
    status: string;
    requiredSigners?: number;
  }> {
    // Freeze participates in the SAME per-attempt lock as collaboration writes:
    // it re-reads the RAP under the lock before deciding, so a write that wins
    // the lock first commits as pre-freeze history, and a write that arrives
    // after the freeze wins observes the frozen state and is rejected.
    return this.withAttemptLock(scheduleId, async (tx) => {
      const { schedule, rap } = await this.loadSchedule(scheduleId, tx);
      const assignment = await this.resolveAssignment(scheduleId, userId, tx);
      if (String(assignment.role) !== RAPPORTEUR_ROLE) {
        throw new AppError("Only the assigned Rapporteur may finalize the Committee Report.", 403);
      }
      this.assertReportFinalizationOpen(schedule.sessionStatus);
      if (!rap) {
        throw new AppError("The committee report has not been created for this attempt yet.", 404);
      }

      // Idempotent-safe: an existing freeze is returned, never replaced.
      if (rap.frozenAt && rap.frozenContentHash) {
        return {
          frozen: true,
          alreadyFrozen: true,
          reportId: rap.id,
          contentVersion: rap.contentVersion ?? 0,
          contentHash: rap.frozenContentHash,
          status: String(rap.status),
        };
      }
      if (String(rap.status) !== "DRAFT") {
        throw new AppError("Only a draft Committee Report can be finalized.", 409);
      }
      // FIX-6 source-review correction: defense-in-depth against a stale tab/client
      // finalizing a body version the editor did not just persist. The frontend
      // still drains its own autosave first; this is not a substitute for that.
      if (expectedBodyVersion !== null && expectedBodyVersion !== undefined) {
        if (
          !Number.isSafeInteger(expectedBodyVersion) ||
          expectedBodyVersion < 0
        ) {
          throw new AppError("expectedBodyVersion must be a non-negative integer.", 400);
        }
        if (expectedBodyVersion !== (rap.bodyVersion ?? 0)) {
          throw new AppError(
            "Report changed. Refresh and review the latest version.",
            409,
          );
        }
      }
      if (!rap.bodyDocument) {
        throw new AppError("The Committee Report has no content to finalize.", 409);
      }
      const validation = validateReportDocument(rap.bodyDocument);
      if (!validation.ok) {
        throw new AppError("The stored report body is invalid and cannot be finalized.", 409);
      }
      if (!hasMeaningfulReportContent(rap.bodyDocument)) {
        throw new AppError("The Committee Report has no meaningful content to finalize.", 409);
      }

      // FIX-6: Committee Report finalization is intentionally independent of
      // evaluator completion and Oral Examination Summary generation. The two
      // workstreams converge only at the Chairman's formal-verdict gate.
      const freezeContext = await this.loadFreezeContext(scheduleId, assignment.userId, tx);
      const contentVersion = (rap.contentVersion ?? 0) + 1;
      const now = new Date();
      const snapshot = buildRapSigningSnapshot({
        scheduleId,
        thesisId: freezeContext.thesisId,
        defenseType: freezeContext.defenseType,
        studentName: freezeContext.studentName,
        studentNumber: freezeContext.studentNumber,
        programName: freezeContext.programName,
        defenseDate: freezeContext.defenseDate,
        defenseTime: freezeContext.defenseTime,
        venue: freezeContext.venue,
        committee: freezeContext.committee,
        preparedByUserId: assignment.userId,
        preparedByName: freezeContext.preparedByName,
        contentVersion,
        frozenAt: now.toISOString(),
        body: rap.bodyDocument,
      });
      const contentHash = hashRapSnapshot(snapshot);

      const updated = await tx.rapReport.updateMany({
        where: { id: rap.id, status: "DRAFT", frozenAt: null, bodyVersion: rap.bodyVersion ?? 0 },
        data: {
          frozenAt: now,
          frozenById: assignment.userId,
          frozenContent: snapshot as never,
          frozenContentHash: contentHash,
          contentVersion,
          reportDate: rap.reportDate ?? now,
          status: "FOR_SIGNATURE",
        },
      });
      if (updated.count === 0) {
        const current = await tx.rapReport.findUnique({
          where: { id: rap.id },
          select: { status: true, contentVersion: true, frozenContentHash: true },
        });
        if (current?.frozenContentHash) {
          return {
            frozen: true,
            alreadyFrozen: true,
            reportId: rap.id,
            contentVersion: current.contentVersion ?? 0,
            contentHash: current.frozenContentHash,
            status: String(current.status),
          };
        }
        throw new AppError("Report state changed. Refresh and try again.", 409);
      }

      // RAP-C1: derive the exact required signer roster from the attempt's exact
      // PanelAssignments using the stage-aware policy. Facilitator and Dean are
      // excluded by policy; nothing is fabricated. createMany + skipDuplicates is
      // idempotent/race-safe and never duplicates a signer slot.
      const requirements = resolveRapSignatureRequirements(
        freezeContext.committee.map((member) => ({
          userId: member.userId,
          role: member.role,
        })),
        freezeContext.defenseType,
      );
      if (requirements.length === 0) {
        throw new AppError(
          "No required Committee Report signatories exist for this defense session.",
          409,
        );
      }
      await tx.rapReportSignature.createMany({
        data: requirements.map((req) => ({
          rapId: rap.id,
          userId: req.userId,
          roleAtDefense: req.roleAtDefense,
          required: req.required,
          isSigned: false,
        })),
        skipDuplicates: true,
      });

      await writeDefenseAudit(tx, {
        actorId: userId,
        actionType: DEFENSE_AUDIT_ACTIONS.REPORT_FINALIZED,
        targetTable: DEFENSE_AUDIT_TARGETS.REPORT,
        targetId: rap.id,
        metadata: {
          scheduleId,
          thesisId: freezeContext.thesisId,
          defenseType: freezeContext.defenseType,
          reportId: rap.id,
          contentVersion,
          requiredSigners: requirements.length,
          newStatus: "FOR_SIGNATURE",
        },
      });

      return {
        frozen: true,
        alreadyFrozen: false,
        reportId: rap.id,
        contentVersion,
        contentHash,
        status: "FOR_SIGNATURE",
        requiredSigners: requirements.length,
      };
    });
  }

  /**
   * RAP-C1 signing. A required signer signs ONLY their own slot for the exact
   * frozen content version/hash, inside the same per-attempt lock used by freeze
   * and collaboration writes. The final required signature finalizes the RAP via
   * a monotonic, race-safe recompute. Another signer's slot can never be signed.
   */
  async signReportForSignatures(
    scheduleId: string,
    userId: string,
    signatureData: unknown,
  ): Promise<{
    signed: true;
    status: string;
    reportId: string;
    contentVersion: number;
    contentHash: string;
    finalizedNow: boolean;
    signatureProgress: { required: number; signed: number };
  }> {
    const evidence = normalizeSignatureEvidence(signatureData);

    const result = await this.withAttemptLock(scheduleId, async (tx) => {
      const { schedule, rap } = await this.loadSchedule(scheduleId, tx);
      await this.resolveAssignment(scheduleId, userId, tx);

      if (!rap) {
        throw new AppError(
          "The Committee Report has not been created for this attempt yet.",
          409,
        );
      }
      if (!rap.frozenAt || !rap.frozenContentHash) {
        throw new AppError("The Committee Report is not finalized for signatures.", 409);
      }
      const status = String(rap.status);
      if (status === "FINALIZED") {
        throw new AppError("The Committee Report is already complete.", 409);
      }
      if (status !== "FOR_SIGNATURE" && status !== "PARTIALLY_SIGNED") {
        throw new AppError("The Committee Report is not open for signatures.", 409);
      }
      this.assertReportFinalizationOpen(schedule.sessionStatus);

      const slot = await tx.rapReportSignature.findFirst({
        where: { rapId: rap.id, userId },
        select: { id: true, required: true, isSigned: true },
      });
      if (!slot || slot.required === false) {
        throw new AppError("You are not a required signer for this Committee Report.", 403);
      }
      if (slot.isSigned === true) {
        // CDW-9B FIX-1: a committed signature can outlive a failed aggregate
        // recompute. Return a duplicate marker so the committed-state reconcile
        // still runs after the transaction; never rewrite evidence.
        return {
          rapId: rap.id,
          contentVersion: rap.contentVersion ?? 0,
          contentHash: rap.frozenContentHash,
          duplicate: true,
        };
      }

      const updated = await tx.rapReportSignature.updateMany({
        where: {
          id: slot.id,
          userId,
          OR: [{ isSigned: false }, { isSigned: null }],
        },
        data: {
          isSigned: true,
          signatureData: evidence,
          signedAt: new Date(),
          // Bind the signature to the EXACT frozen artifact it reviewed.
          signedContentHash: rap.frozenContentHash,
          signedContentVersion: rap.contentVersion ?? 0,
        },
      });
      if (updated.count === 0) {
        return {
          rapId: rap.id,
          contentVersion: rap.contentVersion ?? 0,
          contentHash: rap.frozenContentHash,
          duplicate: true,
        };
      }

      await writeDefenseAudit(tx, {
        actorId: userId,
        actionType: DEFENSE_AUDIT_ACTIONS.REPORT_SIGNED,
        targetTable: DEFENSE_AUDIT_TARGETS.SIGNATURE,
        targetId: slot.id,
        metadata: {
          scheduleId,
          defenseType: String(schedule.defenseType),
          reportId: rap.id,
          signatureId: slot.id,
          contentVersion: rap.contentVersion ?? 0,
          newStatus: "SIGNED",
        },
      });

      return {
        rapId: rap.id,
        contentVersion: rap.contentVersion ?? 0,
        contentHash: rap.frozenContentHash,
        duplicate: false,
      };
    });

    // Monotonic aggregate recompute (finalizes once all required slots are signed).
    // This also heals a duplicate retry whose first recompute failed after commit.
    const recompute = await this.rapService.recomputeRapStatusWithTransition(
      result.rapId,
    );
    if (result.duplicate) {
      throw new AppError("You have already signed this Committee Report.", 409);
    }
    const status = recompute.status;
    const slots = await prisma.rapReportSignature.findMany({
      where: { rapId: result.rapId },
      select: { required: true, isSigned: true },
    });
    const requiredSlots = slots.filter((s) => s.required !== false);
    const signedSlots = requiredSlots.filter((s) => s.isSigned === true);
    return {
      signed: true,
      status,
      reportId: result.rapId,
      contentVersion: result.contentVersion,
      contentHash: result.contentHash,
      finalizedNow: recompute.transitionedToFinalized,
      signatureProgress: { required: requiredSlots.length, signed: signedSlots.length },
    };
  }

  // ---- Conclusion readiness (read-only facts) ----------------------------

  /**
   * Read-only conclusion-readiness facts for the canonical pre-conclusion
   * sequence (COLLABORATIVE SOT §11): required evaluations finalized, Summary
   * available, committee report frozen, RAP finalized, not already concluded,
   * caller is the assigned Chairman.
   *
   * NOTE: this models the CANONICAL target gate. The current RAP lifecycle still
   * creates the report at conclusion time, so `reportFrozen`/`reportFinalized`
   * remain false until RAP-C1 creates/freezes the report during the defense; the
   * endpoint reports facts and never derives PASSED / REDEFENSE_REQUIRED.
   */
  async getConclusionReadiness(
    scheduleId: string,
    userId: string,
  ): Promise<ConclusionReadiness> {
    const assignment = await this.resolveAssignment(scheduleId, userId);
    const isChairman = String(assignment.role) === CHAIRMAN_ROLE;

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        panelAssignments: {
          where: { isActive: true },
          select: { id: true, userId: true, role: true },
        },
        oralExamScores: { select: { panelId: true, status: true } },
        oralExamSummary: { select: { id: true } },
        conclusion: { select: { id: true } },
        rapReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { signatures: { select: { required: true, isSigned: true } } },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const evaluatorRoles = new DefenseCommitteePolicy()
      .getEvaluatorRoles(schedule.defenseType as never)
      .map(String);
    const evaluatorAssignments = schedule.panelAssignments.filter((a) =>
      evaluatorRoles.includes(String(a.role)),
    );
    const evaluatorIds = new Set(evaluatorAssignments.map((a) => a.id));
    const finalized = schedule.oralExamScores.filter(
      (s) => evaluatorIds.has(s.panelId) && String(s.status) === "FINALIZED",
    );
    const allEvaluationsFinalized =
      evaluatorAssignments.length > 0 && finalized.length >= evaluatorAssignments.length;

    const rap = schedule.rapReports[0] ?? null;
    const requiredSlots = (rap?.signatures ?? []).filter((s) => s.required !== false);
    const signedSlots = requiredSlots.filter((s) => s.isSigned === true);
    const reportFrozen = Boolean(rap?.frozenAt);
    const reportFinalized = String(rap?.status ?? "") === "FINALIZED";
    const concluded = Boolean(schedule.conclusion);
    const oralSummaryExists = Boolean(schedule.oralExamSummary);

    const blockers: string[] = [];
    if (!isChairman) blockers.push("Caller is not the assigned session Chairman.");
    if (concluded) blockers.push("Defense attempt is already concluded.");
    if (evaluatorAssignments.length === 0) blockers.push("No evaluator assignments exist.");
    if (!allEvaluationsFinalized) blockers.push("Not all required evaluations are finalized.");
    if (!oralSummaryExists) blockers.push("Oral Examination Summary is not available.");
    if (!rap) blockers.push("Committee report has not been created.");
    if (!reportFrozen) blockers.push("Committee report is not frozen.");
    if (!reportFinalized) blockers.push("RAP is not finalized.");

    return {
      scheduleId,
      defenseType: String(schedule.defenseType),
      sessionStatus: String(schedule.sessionStatus),
      isChairman,
      concluded,
      evaluatorAssignments: evaluatorAssignments.length,
      finalizedEvaluations: finalized.length,
      allEvaluationsFinalized,
      oralSummaryExists,
      reportExists: rap !== null,
      reportFrozen,
      reportFinalized,
      requiredSignatures: requiredSlots.length,
      signedSignatures: signedSlots.length,
      allSignaturesSigned: requiredSlots.length > 0 && signedSlots.length >= requiredSlots.length,
      blockers,
      readyForConclusion: blockers.length === 0,
    };
  }
}
