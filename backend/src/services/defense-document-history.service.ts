import { AppError } from "../utils/AppError";
import {
  STAGE_EVIDENCE_SLOTS,
  type DefenseEvidenceStage,
} from "./defense-evidence.rules";
import {
  isValidFinalManuscriptBinding,
  isValidProposalManuscriptBinding,
  mapCertStatusToReviewStatus,
  type ProposalReviewStatus,
} from "./proposal-adviser-review.rules";
import {
  DEFENSE_REVIEW_ACTIONS,
  parseAuditObject,
  type DefenseResubmitReplacement,
} from "./defense-review-events";
import { DefenseApplicationDocumentHistoryRepository } from "../repositories/defense-document-history.repository";

const STAGES = ["TITLE", "PROPOSAL", "FINAL"] as const;
export type DefenseHistoryStage = (typeof STAGES)[number];

const STAGE_DEFENSE_TYPE: Record<DefenseHistoryStage, "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE"> = {
  TITLE: "TITLE_DEFENSE",
  PROPOSAL: "PROPOSAL_DEFENSE",
  FINAL: "FINAL_DEFENSE",
};

interface ManuscriptStageConfig {
  docType: string;
  certStage: "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
  binding: (
    cert: { defenseStage: string; reviewedDocumentId?: string | null } | null | undefined,
    doc: { id: string; thesisId: string; docType: string; defenseStage: string | null } | null | undefined,
    thesisId: string,
  ) => boolean;
}

const MANUSCRIPT_CONFIG: Partial<Record<DefenseHistoryStage, ManuscriptStageConfig>> = {
  PROPOSAL: {
    docType: "PROPOSAL_CHAPTERS",
    certStage: "PROPOSAL_DEFENSE",
    binding: isValidProposalManuscriptBinding,
  },
  FINAL: {
    docType: "FINAL_MANUSCRIPT",
    certStage: "FINAL_DEFENSE",
    binding: isValidFinalManuscriptBinding,
  },
};

export interface DocumentSummaryDto {
  id: string;
  docType: string;
  defenseStage: string | null;
  originalFilename: string | null;
  verifiedMimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
}

export interface SupportingEvidenceSlotDto {
  docType: string;
  current: DocumentSummaryDto | null;
  history: DocumentSummaryDto[];
  integrityState: "OK" | "MISSING" | "AMBIGUOUS";
}

export interface ManuscriptVersionDto extends DocumentSummaryDto {
  /** Version-chain head marker only — never certification authority. */
  isVersionHead: boolean;
  /** Document the Adviser certification currently binds to. */
  isReviewedByAdviser: boolean;
  /** ISSUED + exact valid binding. */
  isCertified: boolean;
}

export interface ManuscriptReviewDto {
  applicable: boolean;
  certificationStatus: ProposalReviewStatus;
  adviser: { id: string; name: string } | null;
  reviewRemarks: string | null;
  signedAt: string | null;
  reviewedDocumentId: string | null;
  bindingValid: boolean;
  certifiedDocumentId: string | null;
  versions: ManuscriptVersionDto[];
  warning: string | null;
}

export interface ReviewTimelineEventDto {
  type: string;
  timestamp: string;
  actor: { id: string; name: string } | null;
  reason: string | null;
  description: string | null;
  replacementSummary: {
    previousRejectionReason: string | null;
    replacements: DefenseResubmitReplacement[];
  } | null;
}

export interface DefenseHistoryApplicationState {
  /** True only when the requested stage is the live ThesisRecord stage. */
  isCurrentStage: boolean;
  currentThesisStage: DefenseHistoryStage;
  /** Live status — null for a prior stage (never reconstructed). */
  status: string | null;
  /** Live rejection reason — null for a prior stage. */
  rejectionReason: string | null;
}

export interface DefenseDocumentHistoryDto {
  thesisId: string;
  stage: DefenseHistoryStage;
  application: DefenseHistoryApplicationState;
  supportingEvidence: SupportingEvidenceSlotDto[];
  manuscriptReview: ManuscriptReviewDto | null;
  reviewTimeline: ReviewTimelineEventDto[];
  officialRecord: { scheduleId: string; available: boolean } | null;
}

function toSummary(doc: {
  id: string;
  docType: string;
  defenseStage: string | null;
  originalFilename: string | null;
  verifiedMimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: Date;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
}): DocumentSummaryDto {
  return {
    id: doc.id,
    docType: doc.docType,
    defenseStage: doc.defenseStage,
    originalFilename: doc.originalFilename,
    verifiedMimeType: doc.verifiedMimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt.toISOString(),
    isCurrent: doc.isCurrent,
    supersedesDocumentId: doc.supersedesDocumentId,
  };
}

function actorName(
  actor: { id: string; firstName: string; lastName: string } | null,
): { id: string; name: string } | null {
  if (!actor) return null;
  return {
    id: actor.id,
    name: `${actor.firstName} ${actor.lastName}`.trim(),
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseReplacements(value: unknown): DefenseResubmitReplacement[] | null {
  if (!Array.isArray(value)) return null;
  const out: DefenseResubmitReplacement[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const docType = asString(row.docType);
    const createdDocumentId = asString(row.createdDocumentId);
    if (!docType || !createdDocumentId) continue;
    out.push({
      docType,
      createdDocumentId,
      supersededDocumentId: asString(row.supersededDocumentId),
    });
  }
  return out.length > 0 ? out : null;
}

export class DefenseApplicationDocumentHistoryService {
  constructor(
    private readonly repo = new DefenseApplicationDocumentHistoryRepository(),
  ) {}

  async getDocumentHistory(
    thesisId: string,
    rawStage: string,
  ): Promise<DefenseDocumentHistoryDto> {
    const stage = String(rawStage || "").toUpperCase() as DefenseHistoryStage;
    if (!STAGES.includes(stage)) {
      throw new AppError("Invalid defense stage.", 400);
    }
    if (!thesisId) {
      throw new AppError("Thesis identifier is required.", 400);
    }

    const thesis = await this.repo.getThesis(thesisId);
    if (!thesis) {
      throw new AppError("Defense application not found.", 404);
    }

    // Requested stage, never ThesisRecord.stage (prior-stage history support).
    const docs = await this.repo.getStageDocuments(thesisId, stage);
    const supportingEvidence = this.buildSupportingEvidence(stage, docs);
    const manuscriptReview = await this.buildManuscriptReview(stage, thesisId, docs);
    const reviewTimeline = await this.buildReviewTimeline(thesisId, stage);

    const schedule = await this.repo.getStageScheduleId(
      thesisId,
      STAGE_DEFENSE_TYPE[stage],
    );

    // Never reuse the current ThesisRecord status for a prior-stage request.
    const isCurrentStage = stage === thesis.stage;
    const currentThesisStage = thesis.stage as DefenseHistoryStage;

    return {
      thesisId,
      stage,
      application: {
        isCurrentStage,
        currentThesisStage,
        status: isCurrentStage ? thesis.status : null,
        rejectionReason: isCurrentStage
          ? thesis.rejectionReason ?? null
          : null,
      },
      supportingEvidence,
      manuscriptReview,
      reviewTimeline,
      officialRecord: schedule
        ? { scheduleId: schedule.id, available: true }
        : null,
    };
  }

  private buildSupportingEvidence(
    stage: DefenseHistoryStage,
    docs: Awaited<
      ReturnType<DefenseApplicationDocumentHistoryRepository["getStageDocuments"]>
    >,
  ): SupportingEvidenceSlotDto[] {
    const slots = STAGE_EVIDENCE_SLOTS[stage as DefenseEvidenceStage] ?? [];
    return slots.map((docType) => {
      const rows = docs.filter((d) => d.docType === docType);
      // Legacy rows with null currentness are treated as current (DL-6).
      const current = rows.filter((d) => d.isCurrent !== false);
      const historyRows = rows.filter((d) => d.isCurrent === false);
      const history = historyRows.map(toSummary);

      if (current.length === 0) {
        return { docType, current: null, history, integrityState: "MISSING" };
      }
      if (current.length > 1) {
        // Fail closed: never pick a newest/highest row out of ambiguity.
        return { docType, current: null, history, integrityState: "AMBIGUOUS" };
      }
      return {
        docType,
        current: toSummary(current[0]),
        history,
        integrityState: "OK",
      };
    });
  }

  private async buildManuscriptReview(
    stage: DefenseHistoryStage,
    thesisId: string,
    docs: Awaited<
      ReturnType<DefenseApplicationDocumentHistoryRepository["getStageDocuments"]>
    >,
  ): Promise<ManuscriptReviewDto | null> {
    const config = MANUSCRIPT_CONFIG[stage];
    if (!config) return null;

    const versions = docs
      .filter((d) => d.docType === config.docType)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    const certs = await this.repo.getAdviserCertifications(thesisId, config.certStage);
    const cert = certs[0] ?? null;

    const reviewedDocumentId = cert?.reviewedDocumentId ?? null;
    const bindingValid = Boolean(
      config.binding(cert, cert?.reviewedDocument ?? null, thesisId),
    );
    const certifiedDocumentId =
      bindingValid && cert?.status === "ISSUED" ? reviewedDocumentId : null;

    const currentHeads = versions.filter((d) => d.isCurrent !== false);
    let warning: string | null = null;
    if (cert && !bindingValid) {
      warning =
        "Adviser review binding is invalid or incomplete — reconciliation required.";
    }
    if (currentHeads.length > 1) {
      const ambiguity =
        "Multiple current manuscript versions recorded — reconciliation required.";
      warning = warning ? `${warning} ${ambiguity}` : ambiguity;
    }

    const versionDtos: ManuscriptVersionDto[] = versions.map((d) => ({
      ...toSummary(d),
      isVersionHead: d.isCurrent !== false,
      isReviewedByAdviser: Boolean(reviewedDocumentId && d.id === reviewedDocumentId),
      isCertified: Boolean(certifiedDocumentId && d.id === certifiedDocumentId),
    }));

    return {
      applicable: true,
      certificationStatus: cert
        ? mapCertStatusToReviewStatus(cert.status)
        : "NONE",
      adviser: actorName(cert?.adviser ?? null),
      reviewRemarks: cert?.reviewRemarks ?? null,
      signedAt: cert?.signedAt ? cert.signedAt.toISOString() : null,
      reviewedDocumentId,
      bindingValid,
      certifiedDocumentId,
      versions: versionDtos,
      warning,
    };
  }

  private async buildReviewTimeline(
    thesisId: string,
    stage: DefenseHistoryStage,
  ): Promise<ReviewTimelineEventDto[]> {
    const events = await this.repo.getReviewAuditEvents(thesisId);
    return events
      // DL-8 FIX1: stage-specific timeline. The structured payload `stage` is
      // the only authority; legacy/unscoped events are never guessed.
      .filter((event) => parseAuditObject(event.newValue)?.stage === stage)
      .map((event) => {
      const parsed = parseAuditObject(event.newValue);
      const base: ReviewTimelineEventDto = {
        type: event.actionType,
        timestamp: event.createdAt.toISOString(),
        actor: actorName(event.actor ?? null),
        reason: null,
        description: event.description ?? null,
        replacementSummary: null,
      };

      if (event.actionType === DEFENSE_REVIEW_ACTIONS.REJECT) {
        return { ...base, reason: asString(parsed?.reason) };
      }
      if (event.actionType === DEFENSE_REVIEW_ACTIONS.RESUBMIT) {
        const replacements = parseReplacements(parsed?.replacements);
        return {
          ...base,
          replacementSummary: replacements
            ? {
                previousRejectionReason: asString(
                  parsed?.previousRejectionReason,
                ),
                replacements,
              }
            : null,
        };
      }
      return base;
    });
  }
}
