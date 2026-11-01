import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { adminQuestionSelect, toAdminQuestion, toApplicantQuestion } from "./exam-content.projection";
import type { AdminExamQuestion } from "../interfaces/exam-content.interfaces";
import { validateExamQuestion } from "../services/exam-content.rules";
import { selectionIds } from "../services/exam-question-set.rules";
import { AppError } from "../utils/AppError";

const orderBy = [{ order: "asc" }, { id: "asc" }] as const;
const revisionSummary = { id: true, publishedAt: true, _count: { select: { questions: true } } } as const;

/** Validate the generic Phase A schema, retaining exact stored order, including legacy ties. */
function checkedContent(value: unknown): AdminExamQuestion {
  const row = value as Prisma.ExamQuestionGetPayload<{ select: typeof adminQuestionSelect }>;
  const content = toAdminQuestion(row);
  const { id: _id, options, ...question } = content;
  if (typeof content.id !== "string" || options.some(o => typeof o.id !== "string" || o.questionId !== content.id)
    || new Set(options.map(o => o.id)).size !== options.length) throw new AppError("Invalid published question identities.", 500);
  // Validation-only ranks allow the accepted legacy tied-order representation.
  validateExamQuestion({ ...question, options: options.map(({ questionId: _qid, ...option }, index) => ({ ...option, order: index })) });
  return content;
}

function mediaIds(questions: AdminExamQuestion[]) {
  return [...new Set(questions.flatMap(q => [q.stimulusMediaId, ...q.options.map(o => o.mediaId)]).filter((id): id is string => id !== null))];
}

async function current(tx: Prisma.TransactionClient) {
  const questions = await tx.examQuestion.findMany({ where: { selection: { isNot: null } }, orderBy: [...orderBy], select: { id: true, type: true, order: true, questionText: true } });
  const latest = await tx.examContentRevision.findFirst({ orderBy: [{ publishedAt: "desc" }, { id: "desc" }], select: revisionSummary });
  return { questionIds: questions.map(q => q.id), questions, latestPublication: latest ? { id: latest.id, publishedAt: latest.publishedAt, questionCount: latest._count.questions } : null };
}

export class ExamQuestionSetRepository {
  getCurrent() {
    return prisma.$transaction(tx => current(tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async replaceSelection(payload: unknown) {
    const ids = selectionIds(payload);
    return this.atomic(async tx => {
      const existing = await tx.examQuestion.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (existing.length !== ids.length) throw new AppError("One or more selected questions no longer exist. Reload the Question Set.", 400);
      await tx.examQuestionSelection.deleteMany({});
      if (ids.length) await tx.examQuestionSelection.createMany({ data: ids.map(questionId => ({ questionId })) });
      return current(tx);
    });
  }

  /** Atomically freeze the saved membership and one consistent view of its bank content. */
  async publish(expectedPayload: unknown, actorId: string) {
    const expected = selectionIds(expectedPayload);
    return this.atomic(async tx => {
      const members = await tx.examQuestionSelection.findMany({ select: { questionId: true } });
      if (!members.length) throw new AppError("Select and save questions before publishing.", 400);
      const actual = new Set(members.map(m => m.questionId.toLowerCase()));
      if (expected.length !== actual.size || expected.some(id => !actual.has(id))) {
        throw new AppError("The saved selection changed. Reload and review it before publishing.", 409);
      }
      const rows = await tx.examQuestion.findMany({ where: { id: { in: members.map(m => m.questionId) } }, orderBy: [...orderBy], select: adminQuestionSelect });
      if (rows.length !== members.length) throw new AppError("Selected content changed. Reload and try again.", 409);
      const questions = rows.map(checkedContent);
      const revision = await tx.examContentRevision.create({ data: {
        publishedById: actorId,
        questions: { create: questions.map((q, position) => ({
          questionId: q.id, position, content: q as unknown as Prisma.InputJsonValue,
          options: { create: q.options.map(o => ({ optionId: o.id })) },
        })) },
        media: { create: mediaIds(questions).map(mediaId => ({ mediaId })) },
      }, select: revisionSummary });
      return { id: revision.id, publishedAt: revision.publishedAt, questionCount: revision._count.questions };
    });
  }

  /** INTERNAL B4 contract: resolve an exact identity; never infer latest for an attempt. */
  async getForBinding(revisionId: string) {
    const revision = await prisma.examContentRevision.findUnique({ where: { id: revisionId }, select: {
      id: true, publishedAt: true, questions: { orderBy: { position: "asc" }, select: { questionId: true, position: true, content: true } },
      media: { select: { mediaId: true } },
    } });
    if (!revision) throw new AppError("Published question set not found.", 404);
    const questions = revision.questions.map(item => {
      const q = checkedContent(item.content);
      if (q.id !== item.questionId) throw new AppError("Published question identity mismatch.", 500);
      return q;
    });
    return { id: revision.id, publishedAt: revision.publishedAt, questions,
      mediaIds: revision.media.map(m => m.mediaId),
      answerKey: questions.map(q => ({ questionId: q.id, type: q.type, correctOptionIds: q.options.filter(o => o.isCorrect).map(o => o.id) })),
      applicantQuestions: questions.map(q => toApplicantQuestion(q as Parameters<typeof toApplicantQuestion>[0])),
    };
  }

  private async atomic<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2003"].includes(error.code)) {
        throw new AppError("Question content changed during this action. Reload and try again.", 409);
      }
      throw error;
    }
  }
}
