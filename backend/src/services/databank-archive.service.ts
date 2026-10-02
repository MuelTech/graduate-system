import { AppError } from "../utils/AppError";
import {
  DatabankArchiveRepository,
  type ArchiveRecord,
} from "../repositories/databank-archive.repository";

/**
 * DL-9: private Research Databank archival registration.
 *
 * Databank is a controlled archive, private by default, bound to a COMPLETED
 * Final Defense research context. It is not Repository publication (DL-10) and
 * it does not decide the post-Final archival manuscript artifact — that policy
 * is unresolved, so no file linkage is created.
 */

export const DATABANK_ELIGIBILITY_REASONS = {
  FINAL_DEFENSE_NOT_PASSED: "FINAL_DEFENSE_NOT_PASSED",
  FINAL_RAP_NOT_FINALIZED: "FINAL_RAP_NOT_FINALIZED",
  OFFICIAL_TITLE_MISSING: "OFFICIAL_TITLE_MISSING",
  RESEARCH_CONTEXT_MISSING: "RESEARCH_CONTEXT_MISSING",
  RESEARCH_CONTEXT_AMBIGUOUS: "RESEARCH_CONTEXT_AMBIGUOUS",
} as const;

export type DatabankEligibilityReason =
  (typeof DATABANK_ELIGIBILITY_REASONS)[keyof typeof DATABANK_ELIGIBILITY_REASONS];

export interface DatabankResearchContextDto {
  thesisId: string;
  officialTitle: string;
  finalDefenseConcludedAt: string | null;
  finalRapFinalizedAt: string | null;
}

export interface DatabankArchiveSummaryDto {
  id: string;
  officialTitle: string;
  abstract: string | null;
  keywords: string | null;
  registeredAt: string;
}

export interface DatabankArchiveContextDto {
  eligible: boolean;
  reasons: DatabankEligibilityReason[];
  researchContext: DatabankResearchContextDto | null;
  archive: DatabankArchiveSummaryDto | null;
  artifactPolicy: {
    archivalArtifactLinked: false;
    policyResolved: false;
  };
}

export interface RegisterArchiveMetadata {
  abstract?: unknown;
  keywords?: unknown;
}

interface ResolvedContext {
  thesisId: string;
  scheduleId: string;
  officialTitle: string;
  concludedAt: Date | null;
  rapFinalizedAt: Date | null;
}

type ResolveResult =
  | { eligible: true; context: ResolvedContext }
  | { eligible: false; reasons: DatabankEligibilityReason[] };

/** Trim and collapse empty values to null; never trust caller authority. */
function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toArchiveDto(archive: ArchiveRecord, officialTitle: string): DatabankArchiveSummaryDto {
  return {
    id: archive.id,
    // Thesis/Title authority wins over the mutable ELibrary.title snapshot.
    officialTitle,
    abstract: archive.abstract ?? null,
    keywords: archive.keywords ?? null,
    registeredAt: archive.createdAt.toISOString(),
  };
}

export class DatabankArchiveService {
  constructor(private readonly repo = new DatabankArchiveRepository()) {}

  private async requireStudent(userId: string): Promise<string> {
    const student = await this.repo.getStudentByUserId(userId);
    if (!student) {
      throw new AppError("Student profile not found.", 404);
    }
    return student.id;
  }

  /**
   * Authoritative completed Final research context:
   *   Final DefenseConclusion.outcome = PASSED
   *   AND the FINALIZED RAP belongs to the SAME Final schedule.
   */
  private async resolveCompletedContext(studentId: string): Promise<ResolveResult> {
    const thesisIds = await this.repo.getThesisIdsForStudent(studentId);
    if (thesisIds.length === 0) {
      return {
        eligible: false,
        reasons: [DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_MISSING],
      };
    }

    const completed: ResolvedContext[] = [];
    let sawFinalNotPassed = false;
    let sawPassedWithoutRap = false;

    for (const thesisId of thesisIds) {
      const conclusion = await this.repo.getFinalConclusionForThesis(thesisId);
      if (!conclusion) continue;
      if (conclusion.outcome !== "PASSED") {
        sawFinalNotPassed = true;
        continue;
      }
      const rap = await this.repo.getFinalizedRapForSchedule(conclusion.scheduleId);
      if (!rap) {
        sawPassedWithoutRap = true;
        continue;
      }
      const officialTitle = await this.repo.getOfficialTitleForThesis(thesisId);
      if (!officialTitle) {
        // Completed Final but no valid official Title authority → fail closed.
        return {
          eligible: false,
          reasons: [DATABANK_ELIGIBILITY_REASONS.OFFICIAL_TITLE_MISSING],
        };
      }
      completed.push({
        thesisId,
        scheduleId: conclusion.scheduleId,
        officialTitle,
        concludedAt: conclusion.concludedAt ?? null,
        rapFinalizedAt: rap.finalizedAt ?? null,
      });
    }

    if (completed.length === 0) {
      const reasons: DatabankEligibilityReason[] = [];
      if (sawPassedWithoutRap) {
        reasons.push(DATABANK_ELIGIBILITY_REASONS.FINAL_RAP_NOT_FINALIZED);
      }
      if (sawFinalNotPassed || reasons.length === 0) {
        reasons.push(DATABANK_ELIGIBILITY_REASONS.FINAL_DEFENSE_NOT_PASSED);
      }
      return { eligible: false, reasons };
    }

    if (completed.length > 1) {
      // Never nominate latest/highest. Require administrative reconciliation.
      return {
        eligible: false,
        reasons: [DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_AMBIGUOUS],
      };
    }

    return { eligible: true, context: completed[0] };
  }

  /** STUDENT read model: eligibility, research context, existing archive. */
  async getArchiveContext(userId: string): Promise<DatabankArchiveContextDto> {
    const studentId = await this.requireStudent(userId);
    const resolved = await this.resolveCompletedContext(studentId);

    if (!resolved.eligible) {
      return {
        eligible: false,
        reasons: resolved.reasons,
        researchContext: null,
        archive: null,
        artifactPolicy: { archivalArtifactLinked: false, policyResolved: false },
      };
    }

    const { context } = resolved;
    const archive = await this.repo.getArchiveByThesisId(context.thesisId);
    return {
      eligible: true,
      reasons: [],
      researchContext: {
        thesisId: context.thesisId,
        officialTitle: context.officialTitle,
        finalDefenseConcludedAt: context.concludedAt
          ? context.concludedAt.toISOString()
          : null,
        finalRapFinalizedAt: context.rapFinalizedAt
          ? context.rapFinalizedAt.toISOString()
          : null,
      },
      archive: archive ? toArchiveDto(archive, context.officialTitle) : null,
      artifactPolicy: { archivalArtifactLinked: false, policyResolved: false },
    };
  }

  /**
   * STUDENT registration. All authority fields are server-derived; only safe
   * private metadata is accepted from the client.
   */
  async registerArchive(
    userId: string,
    metadata: RegisterArchiveMetadata = {},
  ): Promise<DatabankArchiveSummaryDto> {
    const studentId = await this.requireStudent(userId);
    const resolved = await this.resolveCompletedContext(studentId);
    if (!resolved.eligible) {
      const ambiguous = resolved.reasons.includes(
        DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_AMBIGUOUS,
      );
      throw new AppError(
        `Research is not eligible for Databank registration (${resolved.reasons.join(", ")}).`,
        ambiguous ? 409 : 400,
      );
    }

    const { context } = resolved;
    const existing = await this.repo.getArchiveByThesisId(context.thesisId);
    if (existing) {
      throw new AppError("Archive already registered.", 409);
    }

    try {
      const created = await this.repo.createArchive({
        thesisId: context.thesisId,
        title: context.officialTitle,
        abstract: optionalText(metadata.abstract),
        keywords: optionalText(metadata.keywords),
      });
      return toArchiveDto(created, context.officialTitle);
    } catch (error) {
      // ELibrary.thesisId is unique: map the race loser cleanly.
      if ((error as { code?: string })?.code === "P2002") {
        throw new AppError("Archive already registered.", 409);
      }
      throw error;
    }
  }
}
