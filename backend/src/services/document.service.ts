// backend/src/services/document.service.ts
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { storageService } from "../storage";
import { isAuthoritativePriorProposalManuscript } from "./proposal-adviser-review.rules";

interface ModelConfig {
    prismaModel: string;
    fileField: string;
    include?: Record<string, any>;
    getOwnerId: (record: any) => string | null;
    getExtraAuthCheck?: (record: any, userId: string, userRole: string) => boolean;
}

/**
 * CP6-FIX1: resolve effective stage for thesis documents.
 * Explicit defenseStage wins. Legacy null stage may be inferred only for
 * known academic manuscript types; otherwise null (fail closed for Panelists).
 */
export function resolveThesisDocumentStage(input: {
  docType?: string | null;
  defenseStage?: string | null;
}): "TITLE" | "PROPOSAL" | "FINAL" | null {
  if (input.defenseStage === "TITLE" || input.defenseStage === "PROPOSAL" || input.defenseStage === "FINAL") {
    return input.defenseStage;
  }
  // Legacy unscoped academic manuscripts only.
  if (input.docType === "TITLE_PROPOSAL") return "TITLE";
  if (input.docType === "PROPOSAL_CHAPTERS") return "PROPOSAL";
  if (input.docType === "FINAL_MANUSCRIPT") return "FINAL";
  return null;
}

const STAGE_TO_DEFENSE_TYPE: Record<string, string> = {
  TITLE: "TITLE_DEFENSE",
  PROPOSAL: "PROPOSAL_DEFENSE",
  FINAL: "FINAL_DEFENSE",
};

/**
 * UIUX-3B FIX-1: only research-paper documents may be granted to a Panelist
 * through the stage-assignment path. Evidence/administrative rows (COR, RECEIPT,
 * INSTRUMENTS, RESPONDENT_DATA, PLAGIARISM_REPORT) are frequently persisted with
 * an explicit `defenseStage`; an explicit stage must never widen Panelist access
 * beyond the authorized manuscripts. Active advisers keep their separate path.
 */
const PANELIST_STAGE_DOC_TYPES = new Set([
  "TITLE_PROPOSAL",
  "PROPOSAL_CHAPTERS",
  "FINAL_MANUSCRIPT",
]);

/**
 * CP6-FIX1: stage-aware thesis document access for Panelists.
 * Stage-scoped or safely inferred stage docs require a matching defense-type
 * assignment. Ambiguous unscoped docs fail closed. Active advisers allowed.
 *
 * CP8 narrow exception: a Final Defense participant may access only the
 * exact authoritative prior Proposal manuscript (ISSUED Proposal certification
 * reviewedDocumentId) — never arbitrary Proposal revisions.
 */
export function canPanelistAccessThesisDocument(
  record: {
    id?: string;
    /** ThesisDocument.thesisId — required for full certified-manuscript validation. */
    thesisId?: string;
    defenseStage?: string | null;
    docType?: string | null;
    thesis?: {
      id?: string;
      student?: {
        adviserAssignments?: Array<{ adviserId: string }>;
      } | null;
      adviserCertifications?: Array<{
        defenseStage: string;
        status: string;
        reviewedDocumentId?: string | null;
      }> | null;
      defenseSchedules?: Array<{
        defenseType?: string;
        panelAssignments?: Array<{ userId: string }>;
      }> | null;
    } | null;
  },
  userId: string,
): boolean {
  const activeAdviserIds: string[] =
    record.thesis?.student?.adviserAssignments?.map((a) => a.adviserId) ?? [];
  if (activeAdviserIds.includes(userId)) return true;

  const effectiveStage = resolveThesisDocumentStage({
    docType: record.docType,
    defenseStage: record.defenseStage,
  });
  // Ambiguous legacy unscoped document → fail closed for Panelists.
  if (!effectiveStage) return false;

  const requiredType = STAGE_TO_DEFENSE_TYPE[effectiveStage];
  const schedules = record.thesis?.defenseSchedules ?? [];
  const isPanelistStageDocType = PANELIST_STAGE_DOC_TYPES.has(
    String(record.docType ?? ""),
  );
  const hasMatchingStageAssignment =
    isPanelistStageDocType &&
    schedules.some(
      (ds) =>
        ds.defenseType === requiredType &&
        ds.panelAssignments?.some((pa) => pa.userId === userId),
    );
  if (hasMatchingStageAssignment) return true;

  // CP8-FIX1: Final Defense participant → full certified prior Proposal manuscript only
  // (ISSUED cert + reviewedDocumentId + same thesis + PROPOSAL_CHAPTERS + stage PROPOSAL).
  if (effectiveStage === "PROPOSAL") {
    const isFinalParticipant = schedules.some(
      (ds) =>
        ds.defenseType === "FINAL_DEFENSE" &&
        ds.panelAssignments?.some((pa) => pa.userId === userId),
    );
    if (!isFinalParticipant) return false;

    const proposalCert = (record.thesis?.adviserCertifications ?? []).find(
      (c) =>
        c.defenseStage === "PROPOSAL_DEFENSE" && c.status === "ISSUED",
    );
    // Full identity: doc.thesisId must match the thesis that owns the cert.
    const docThesisId = record.thesisId ?? null;
    const certThesisId = record.thesis?.id ?? null;
    if (!docThesisId || !certThesisId || !record.id) return false;
    return isAuthoritativePriorProposalManuscript(
      {
        id: record.id,
        thesisId: docThesisId,
        docType: record.docType ?? "",
        defenseStage: record.defenseStage ?? null,
      },
      proposalCert ?? null,
      certThesisId,
    );
  }

  return false;
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
    "cor-upload": {
        prismaModel: "corUpload",
        fileField: "filePath",
        include: { student: { include: { user: true } } },
        getOwnerId: (r) => r.student?.user?.id ?? null,
    },
    "thesis-document": {
        prismaModel: "thesisDocument",
        fileField: "filePath",
        include: {
            thesis: {
                include: {
                    student: {
                        include: {
                            user: true,
                            adviserAssignments: {
                                where: { isActive: true },
                                select: { adviserId: true },
                            },
                        },
                    },
                    adviserCertifications: {
                        where: { status: "ISSUED" },
                        select: {
                            defenseStage: true,
                            status: true,
                            reviewedDocumentId: true,
                        },
                    },
                    defenseSchedules: {
                        include: {
                            panelAssignments: true,
                        },
                    },
                },
            },
        },
        getOwnerId: (r) => r.thesis?.student?.user?.id ?? null,
        getExtraAuthCheck: (record, userId, userRole) => {
            if (userRole !== "PANELIST") return false;
            return canPanelistAccessThesisDocument(record, userId);
        },
    },
    "rap-report": {
        prismaModel: "rapReport",
        fileField: "filePath",
        include: {},
        getOwnerId: () => null,
    },
    "student-requirement": {
        prismaModel: "studentRequirement",
        fileField: "filePath",
        include: { student: { include: { user: true } } },
        getOwnerId: (r) => r.student?.userId ?? null,
    },
    "plagiarism-result": {
        prismaModel: "plagiarismResult",
        fileField: "filePath",
        include: { thesis: { include: { student: { include: { user: true } } } } },
        getOwnerId: (r) => r.thesis?.student?.user?.id ?? null,
    },
};

export class DocumentService {
    async resolveDocument(
        modelType: string,
        id: string,
        userId: string,
        userRole: string
    ): Promise<{ filePath: string; mimeType: string; originalFilename: string }> {
        const config = MODEL_REGISTRY[modelType];
        if (!config) {
            throw new AppError("Unknown document type", 400);
        }

        // Verify the requesting user is active (not dismissed/graduated)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
        });
        if (!user || user.isActive === false) {
            throw new AppError("Account is not active", 403);
        }

        // Fetch record using raw prisma query to support dynamic model access
        const record = await (prisma as any)[config.prismaModel].findUnique({
            where: { id },
            include: config.include,
        });

        if (!record) {
            throw new AppError("Document not found", 404);
        }

        // Permission check: owner or authorized role
        const isOwner = config.getOwnerId(record) === userId;
        const isAdmin = userRole === "ADMIN";
        const hasExtraAuth = config.getExtraAuthCheck?.(record, userId, userRole) ?? false;

        if (!isOwner && !isAdmin && !hasExtraAuth) {
            // Log unauthorized access attempt
            await prisma.auditLog.create({
                data: {
                    actorId: userId,
                    actionType: "DOCUMENT_ACCESS_DENIED",
                    targetTable: config.prismaModel,
                    targetId: id,
                    description: `Unauthorized document access attempt by ${userRole}`,
                },
            }).catch(() => {}); // Best-effort — do not fail the request over logging
            throw new AppError("Not authorized to view this document", 403);
        }

        // Resolve the file through the storage abstraction: modern storage key
        // first, legacy `filePath` fallback. Path containment + symlink safety
        // are centralized in the local provider.
        const resolvedPath = await storageService.resolveReadPath({
            storageKey: (record as any).storageKey ?? null,
            filePath: record[config.fileField] ?? null,
        });

        // Prefer stored verified MIME/original filename; fall back for legacy.
        const mimeType = storageService.pickMimeType(record, resolvedPath);
        const originalFilename = storageService.pickOriginalFilename(
            record,
            resolvedPath,
        );

        // Log successful document view (best-effort)
        await prisma.auditLog.create({
            data: {
                actorId: userId,
                actionType: "DOCUMENT_VIEW",
                targetTable: config.prismaModel,
                targetId: id,
                description: `Document viewed: ${originalFilename}`,
            },
        }).catch(() => {});

        return { filePath: resolvedPath, mimeType, originalFilename };
    }
}
