import { Prisma, type PrismaClient } from "@prisma/client";
import prisma from "../config/database";
import { FacultyEssayAuthorization, facultyEssayAuthorization } from "../access/faculty-essay-authorization";
import { evaluationAuthoritySelect, evaluationScoreSelect } from "./exam-essay-evaluation.projection";
import { requirePendingEssayReview, writeLockedEssayEvaluation } from "./exam-essay-evaluation.writer";
import { scheduleIdentifier } from "../services/exam-schedule.rules";
import { essayScoreValue } from "../services/exam-essay-evaluation.rules";
import { AppError } from "../utils/AppError";

const select = {
  id: true, status: true, examDate: true, ...evaluationAuthoritySelect, score: { select: evaluationScoreSelect },
  student: { select: { pinnacleApplicantId: true, user: { select: { firstName: true, lastName: true } } } },
  program: { select: { programName: true } },
} as const satisfies Prisma.EntranceExamApplicationSelect;
type Application = Prisma.EntranceExamApplicationGetPayload<{ select: typeof select }>;
function context(app: Application) {
  return { applicationId: app.id,
    applicant: { firstName: app.student.user.firstName, lastName: app.student.user.lastName, pinnacleApplicantId: app.student.pinnacleApplicantId },
    programName: app.program.programName, examDate: app.examDate?.toISOString() ?? null, finalizedAt: app.finalizedAt!.toISOString() };
}

export class FacultyEssayEvaluationRepository {
  constructor(private readonly authorization: FacultyEssayAuthorization = facultyEssayAuthorization,
    private readonly database: PrismaClient = prisma) {}

  private async pending(tx: Prisma.TransactionClient, id: string) {
    const app = await tx.entranceExamApplication.findUnique({ where: { id }, select });
    if (!app) throw new AppError("Essay evaluation not found.", 404);
    return { app, evaluation: await requirePendingEssayReview(tx, app) };
  }

  async queue(actorId: string, cursor?: unknown) {
    await this.authorization.assert(actorId);
    const after = cursor === undefined ? undefined : scheduleIdentifier(cursor, "cursor");
    return this.database.$transaction(async tx => {
      await this.authorization.assertRead(tx, actorId);
      // Prefilters are only a candidate scan; every returned row must pass the real B7 resolver.
      const candidates = await tx.entranceExamApplication.findMany({
        where: { status: "TAKEN", score: { is: { status: "PENDING" } }, ...(after ? { id: { gt: after } } : {}) },
        select, orderBy: { id: "asc" }, take: 51,
      });
      const items = [];
      for (const app of candidates.slice(0, 50)) {
        try {
          await requirePendingEssayReview(tx, app);
          items.push({ ...context(app), status: "PENDING" as const });
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          // Corrupt/legacy frozen evidence is not pending work. No error text/data is serialized.
        }
      }
      return { items, nextCursor: candidates.length > 50 ? candidates[49].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async detail(applicationId: string, actorId: string) {
    await this.authorization.assert(actorId);
    const id = scheduleIdentifier(applicationId, "applicationId");
    return this.database.$transaction(async tx => {
      await this.authorization.assertRead(tx, actorId);
      const { app, evaluation } = await this.pending(tx, id);
      return { ...context(app), status: "PENDING" as const, questionId: evaluation.questionId,
        question: evaluation.question, responseText: evaluation.responseText,
        responseState: evaluation.responseState, maximumScore: evaluation.maximumScore };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async grade(applicationId: string, essayScore: number, actorId: string) {
    await this.authorization.assert(actorId);
    const id = scheduleIdentifier(applicationId, "applicationId"); essayScoreValue(essayScore);
    return this.database.$transaction(async tx => {
      await this.authorization.lockEvaluator(tx, actorId);
      const rows = await tx.$queryRaw<unknown[]>`SELECT application_id FROM entrance_exam_applications WHERE application_id = ${id} FOR UPDATE`;
      if (!rows.length) throw new AppError("Essay evaluation not found.", 404);
      const { app } = await this.pending(tx, id);
      const completed = await writeLockedEssayEvaluation(tx, app, essayScore, actorId);
      // B8 is computed/persisted internally; Faculty never receives its result/breakdown.
      return { applicationId: id, status: "COMPLETED" as const, essayScore: completed.essayScore,
        maximumScore: completed.maximumScore, evaluator: completed.evaluator, evaluatedAt: completed.evaluatedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });
  }

  /** Internal exact-essay media entitlement, not a generic revision/Question Bank grant. */
  async mediaContext(applicationId: string, mediaId: string, actorId: string) {
    await this.authorization.assert(actorId);
    const id = scheduleIdentifier(applicationId, "applicationId");
    scheduleIdentifier(mediaId, "mediaId");
    return this.database.$transaction(async tx => {
      await this.authorization.assertRead(tx, actorId);
      const { app, evaluation } = await this.pending(tx, id);
      if (evaluation.question.stimulusType !== "IMAGE" || evaluation.question.stimulusMediaId !== mediaId) {
        throw new AppError("Exam media not found.", 404);
      }
      return app.contentRevisionId!;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
