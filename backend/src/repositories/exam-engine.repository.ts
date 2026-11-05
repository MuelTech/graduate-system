import prisma from "../config/database";
import { Prisma, ExamAppStatus } from "@prisma/client";
import type { ExamQuestionInput } from "../interfaces/exam-content.interfaces";
import { mergeExamQuestionUpdate } from "../services/exam-content.rules";
import { AppError } from "../utils/AppError";
import { adminQuestionSelect, toAdminQuestion } from "./exam-content.projection";
import { validateDraft } from "../services/exam-answer.rules";
import { activeBoundExecution } from "./exam-execution.repository";
import { scheduleIdentifier } from "../services/exam-schedule.rules";

async function lockAnswerApplication(tx: Prisma.TransactionClient, applicationId: string) {
  // A locking/current read is essential under InnoDB REPEATABLE READ. Do not
  // authorize from a snapshot or a service-level read made before this lock.
  const rows = await tx.$queryRaw<{ status: ExamAppStatus }[]>`
    SELECT status FROM entrance_exam_applications
    WHERE application_id = ${applicationId} FOR UPDATE
  `;
  if (!rows.length) throw new AppError("Exam application not found.", 404);
  if (rows[0].status !== ExamAppStatus.PENDING && rows[0].status !== ExamAppStatus.APPROVED) {
    throw new AppError("This application cannot accept answer writes or final submission.", 409);
  }
}

function emphasisJson(value: ExamQuestionInput["questionTextEmphasis"] | ExamQuestionInput["structuredStimulusEmphasis"]) {
  return value == null ? Prisma.DbNull : value as unknown as Prisma.InputJsonValue;
}
function optionData(opt: ExamQuestionInput["options"][number]) {
  return { ...opt, optionTextEmphasis: emphasisJson(opt.optionTextEmphasis) };
}

function questionData(data: ExamQuestionInput) {
  return {
    questionText: data.questionText, questionTextEmphasis: emphasisJson(data.questionTextEmphasis), type: data.type, order: data.order,
    stimulusType: data.stimulusType, stimulusMediaId: data.stimulusMediaId,
    structuredStimulusEmphasis: emphasisJson(data.structuredStimulusEmphasis),
    structuredStimulus: data.structuredStimulus === null ? Prisma.DbNull : data.structuredStimulus as Prisma.InputJsonValue,
  };
}

export class ExamEngineRepository {
  private async draftTransaction<T>(applicationId: string, userId: string, operation: (tx: Prisma.TransactionClient, bound: Awaited<ReturnType<typeof activeBoundExecution>>) => Promise<T>) {
    const id = scheduleIdentifier(applicationId, "applicationId");
    return prisma.$transaction(async tx => {
      const target = await tx.entranceExamApplication.findUnique({ where: { id }, select: { student: { select: { userId: true } } } });
      if (!target || target.student.userId !== userId) throw new AppError("Exam application not found.", 404);
      await lockAnswerApplication(tx, id);
      const bound = await activeBoundExecution(tx, id);
      if (bound.app.student.userId !== userId) throw new AppError("Exam application not found.", 404);
      const result = await operation(tx, bound);
      bound.assertTime(); // Deadline crossed during persistence => roll back.
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async readDrafts(applicationId: string, userId: string) {
    return this.draftTransaction(applicationId, userId, async (tx, bound) => {
      const questions = bound.content.questions;
      const rows = await tx.applicantAnswer.findMany({
        where: { applicationId, questionId: { in: questions.map(q => q.id) } },
        select: { questionId: true, selectedOptionId: true, essayAnswer: true, draftRevision: true },
        orderBy: { questionId: "asc" },
      });
      return rows.map(row => {
        const question = questions.find(q => q.id === row.questionId)!;
        if (question.type === "MULTIPLE_CHOICE" && row.essayAnswer === null &&
            (row.selectedOptionId === null || question.options.some(o => o.id === row.selectedOptionId))) {
          return { questionId: row.questionId, selectedOptionId: row.selectedOptionId, revision: row.draftRevision };
        }
        if (question.type === "ESSAY" && row.selectedOptionId === null && typeof row.essayAnswer === "string") {
          return { questionId: row.questionId, essayAnswer: row.essayAnswer, revision: row.draftRevision };
        }
        throw new AppError("Saved answers require staff review.", 409);
      });
    });
  }

  async saveDraft(applicationId: string, payload: unknown, userId: string) {
    const answer = validateDraft(payload);
    return this.draftTransaction(applicationId, userId, async (tx, bound) => {
      const question = bound.content.questions.find(q => q.id === answer.questionId);
      if (!question) throw new AppError("Draft question does not belong to this examination.", 400);
      if (question.type === "MULTIPLE_CHOICE") {
        if (answer.selectedOptionId === undefined || (answer.selectedOptionId !== null && !question.options.some(o => o.id.toLowerCase() === answer.selectedOptionId))) {
          throw new AppError("Select an option belonging to this multiple-choice question, or clear it.", 400);
        }
      } else if (question.type !== "ESSAY" || answer.essayAnswer === undefined) {
        throw new AppError("Draft representation does not match the question type.", 400);
      }
      const where = { applicationId_questionId: { applicationId, questionId: answer.questionId } };
      const current = await tx.applicantAnswer.findUnique({ where, select: { draftRevision: true } });
      if ((current?.draftRevision ?? 0) !== answer.expectedRevision) {
        throw new AppError("This answer changed elsewhere. Refresh saved answers before continuing.", 409);
      }
      const revision = answer.expectedRevision + 1;
      const data = { selectedOptionId: answer.selectedOptionId ?? null, essayAnswer: answer.essayAnswer ?? null, draftRevision: revision };
      bound.assertTime();
      await tx.applicantAnswer.upsert({ where, update: data, create: { applicationId, questionId: answer.questionId, ...data } });
      return answer.essayAnswer !== undefined
        ? { questionId: answer.questionId, essayAnswer: answer.essayAnswer, revision }
        : { questionId: answer.questionId, selectedOptionId: answer.selectedOptionId!, revision };
    });
  }

  // Compatibility for internal callers only; unversioned writes now fail validation.
  async autoSaveAnswer(
    applicationId: string,
    questionId: unknown,
    essayAnswer: unknown,
    expectedRevision: unknown,
    userId: string,
  ) {
    return this.saveDraft(applicationId, { questionId, essayAnswer, expectedRevision }, userId);
  }

  async getAllQuestionsForAdmin() {
    const rows = await prisma.examQuestion.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: adminQuestionSelect,
    });
    return rows.map(toAdminQuestion);
  }

  async createQuestion(data: ExamQuestionInput) {
    if (data.options.some(opt => opt.id !== undefined)) throw new AppError("New options cannot specify existing IDs.", 400);
    const row = await prisma.examQuestion.create({
      data: {
        ...questionData(data),
        options: { create: data.options.map(optionData) },
      },
      select: adminQuestionSelect,
    });
    return toAdminQuestion(row);
  }

  async updateQuestion(id: string, patch: unknown) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.examQuestion.findUnique({ where: { id }, select: adminQuestionSelect });
      if (!current) throw new AppError("Question not found.", 404);
      const currentDto = toAdminQuestion(current);
      // The original order migration defaulted every legacy option to zero.
      // For validation only, use the stable read order when legacy orders tie.
      // Metadata-only updates must not rewrite these rows or their identities.
      const hasLegacyOrderTies = new Set(currentDto.options.map(opt => opt.order)).size !== currentDto.options.length;
      const data = mergeExamQuestionUpdate({
        ...questionDataForValidation(currentDto),
        options: currentDto.options.map(({ questionId: _questionId, ...opt }, index) => ({
          ...opt, order: hasLegacyOrderTies ? index : opt.order,
        })),
      }, patch);
      const replacesOptions = Object.prototype.hasOwnProperty.call(patch, "options");
      if (replacesOptions) {
        const existingIds = new Set(current.options.map(opt => opt.id));
        for (const opt of data.options) {
          if (opt.id !== undefined && !existingIds.has(opt.id)) throw new AppError("Option ID does not belong to this question.", 400);
        }
        const retainedIds = new Set(data.options.flatMap(opt => opt.id === undefined ? [] : [opt.id]));
        const removedIds = current.options.filter(opt => !retainedIds.has(opt.id)).map(opt => opt.id);
        if (removedIds.length && await tx.applicantAnswer.count({ where: { selectedOptionId: { in: removedIds } } })) {
          throw new AppError("Cannot replace options referenced by Applicant answers; preserve their IDs.", 409);
        }
        if (removedIds.length && await tx.examRevisionOption.count({ where: { optionId: { in: removedIds } } })) {
          throw new AppError("Cannot remove options in a published question set; preserve their IDs.", 409);
        }
        if (removedIds.length) await tx.examOption.deleteMany({ where: { questionId: id, id: { in: removedIds } } });
        for (const { id: optionId, ...opt } of data.options) {
          if (optionId) await tx.examOption.update({ where: { id: optionId }, data: optionData(opt) });
          else await tx.examOption.create({ data: { ...optionData(opt), questionId: id } });
        }
      }

      const row = await tx.examQuestion.update({
        where: { id },
        data: questionData(data),
        select: adminQuestionSelect,
      });
      return toAdminQuestion(row);
    });
  }

  async deleteQuestion(id: string) {
    try {
      return await prisma.$transaction(async tx => {
        if (await tx.applicantAnswer.count({ where: { questionId: id } })
          || await tx.examRevisionQuestion.count({ where: { questionId: id } })) {
          throw new AppError("This question has answer history or belongs to a published set. Deselect it from future sets instead.", 409);
        }
        return tx.examQuestion.delete({ where: { id } });
      });
    } catch (error) {
      // The FK remains authoritative if a reference is committed after the guard.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new AppError("This question is in use. Deselect it from future sets instead.", 409);
      }
      throw error;
    }
  }
}

function questionDataForValidation(data: ExamQuestionInput): Omit<ExamQuestionInput, "options"> {
  return {
    questionText: data.questionText, questionTextEmphasis: data.questionTextEmphasis, type: data.type, order: data.order,
    stimulusType: data.stimulusType, stimulusMediaId: data.stimulusMediaId,
    structuredStimulus: data.structuredStimulus, structuredStimulusEmphasis: data.structuredStimulusEmphasis,
  };
}
