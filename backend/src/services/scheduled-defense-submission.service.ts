import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { resolveAdviserBoundAcademicManuscript } from "./adviser-document.rules";
import {
  DefenseApplicationDocumentHistoryService,
  type DefenseHistoryStage,
} from "./defense-document-history.service";
import {
  OfficialDefenseDocumentService,
  type OfficialDefenseDocumentActor,
} from "./official-defense-document.service";

const STAGES: Record<string, DefenseHistoryStage> = {
  TITLE_DEFENSE: "TITLE",
  PROPOSAL_DEFENSE: "PROPOSAL",
  FINAL_DEFENSE: "FINAL",
};

/** Exact scheduled context, with stage evidence history. No current manuscript lookup. */
export class ScheduledDefenseSubmissionService {
  constructor(
    private readonly db: Pick<typeof prisma, "defenseSchedule"> = prisma,
    private readonly history: Pick<
      DefenseApplicationDocumentHistoryService,
      "getStageSupportingEvidence"
    > = new DefenseApplicationDocumentHistoryService(),
    private readonly certifications: Pick<
      OfficialDefenseDocumentService,
      "listAdviserCertifications"
    > = new OfficialDefenseDocumentService(),
  ) {}

  async getSubmission(scheduleId: string, actor: OfficialDefenseDocumentActor) {
    if (actor.role !== "ADMIN" || !actor.userId)
      throw new AppError("Admin access is required.", 403);
    const schedule = await this.db.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        thesisId: true,
        defenseType: true,
        manuscriptDocumentId: true,
        manuscriptDocument: {
          select: {
            id: true,
            thesisId: true,
            docType: true,
            defenseStage: true,
            manuscriptTitle: true,
            originalFilename: true,
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    const stage = STAGES[schedule.defenseType];
    if (!stage)
      throw new AppError("The scheduled defense stage is invalid.", 409);
    const valid = resolveAdviserBoundAcademicManuscript({
      ...schedule,
      document: schedule.manuscriptDocument,
    });
    const doc = valid ? schedule.manuscriptDocument : null;
    const supportingEvidence = await this.history.getStageSupportingEvidence(
      schedule.thesisId,
      stage,
    );
    const matching =
      stage === "TITLE" || !doc
        ? []
        : (
            await this.certifications.listAdviserCertifications(
              actor,
              schedule.thesisId,
              stage,
            )
          ).filter(
            (row) =>
              row.thesisId === schedule.thesisId &&
              row.stage === stage &&
              row.manuscriptDocumentId === doc.id &&
              row.status === "ISSUED",
          );
    const certificationState =
      stage === "TITLE"
        ? "NOT_APPLICABLE"
        : !doc
          ? "INVALID_BINDING"
          : matching.length === 0
            ? "MISSING"
            : matching.length > 1
              ? "AMBIGUOUS"
              : "OK";
    return {
      scheduleId: schedule.id,
      thesisId: schedule.thesisId,
      stage,
      manuscriptDocumentId: schedule.manuscriptDocumentId,
      manuscriptIntegrityError: doc
        ? null
        : "The exact schedule-bound manuscript is missing or has an invalid thesis, type, or stage binding. No replacement was selected.",
      manuscript: doc
        ? {
            id: doc.id,
            docType: doc.docType,
            stage,
            manuscriptTitle: doc.manuscriptTitle,
            originalFilename: doc.originalFilename,
          }
        : null,
      supportingEvidence,
      certification: {
        integrityState: certificationState,
        record: certificationState === "OK" ? matching[0] : null,
      },
    };
  }
}
