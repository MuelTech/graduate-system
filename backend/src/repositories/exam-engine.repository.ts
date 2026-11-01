import prisma from "../config/database";
import { Prisma, ExamAppStatus } from "@prisma/client";
import type { ExamQuestionInput } from "../interfaces/exam-content.interfaces";
import { mergeExamQuestionUpdate } from "../services/exam-content.rules";
import { AppError } from "../utils/AppError";
import { applicantQuestionSelect, adminQuestionSelect, toApplicantQuestion, toAdminQuestion } from "./exam-content.projection";
import { validateAnswers, validateEssayAutosave } from "../services/exam-answer.rules";

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
  async getQuestionsForApplicant() {
    const rows = await prisma.examQuestion.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: applicantQuestionSelect,
    });
    return rows.map(toApplicantQuestion);
  }

  async autoSaveAnswer(
    applicationId: string,
    questionId: unknown,
    essayAnswer: unknown,
  ) {
    const answer = validateEssayAutosave({ questionId, essayAnswer });
    return prisma.$transaction(async (tx) => {
      await lockAnswerApplication(tx, applicationId);
      const question = await tx.examQuestion.findUnique({
        where: { id: answer.questionId }, select: { type: true },
      });
      if (!question || question.type !== "ESSAY") throw new AppError("Autosave requires an existing essay question.", 400);
      return tx.applicantAnswer.upsert({
        where: { applicationId_questionId: { applicationId, questionId: answer.questionId } },
        update: { essayAnswer: answer.essayAnswer, selectedOptionId: null },
        create: { applicationId, ...answer, selectedOptionId: null },
      });
    });
  }

  async submitAnswers(applicationId: string, payload: unknown) {
    const answers = validateAnswers(payload);
    return prisma.$transaction(async (tx) => {
      await lockAnswerApplication(tx, applicationId);
      let mcqCorrect = 0;
      // Validate the entire supplied set before the first answer/status/score write.
      // Only bounded scoring authority is loaded; it never enters Applicant DTOs.
      for (const answer of answers) {
        const question = await tx.examQuestion.findUnique({
          where: { id: answer.questionId },
          select: { type: true, options: { select: { id: true, isCorrect: true } } },
        });
        if (!question) throw new AppError("Submitted question does not exist.", 400);
        if (question.type === "MULTIPLE_CHOICE") {
          if (answer.selectedOptionId === undefined) throw new AppError("Multiple-choice questions require a selected option.", 400);
          const selected = question.options.find(option => option.id.toLowerCase() === answer.selectedOptionId);
          if (!selected) throw new AppError("Selected option does not belong to the submitted question.", 400);
          if (selected.isCorrect) mcqCorrect++;
        } else if (question.type === "ESSAY") {
          if (answer.essayAnswer === undefined) throw new AppError("Essay questions require essayAnswer text.", 400);
        } else {
          throw new AppError("Unsupported question type.", 400);
        }
      }

      for (const answer of answers) {
        await tx.applicantAnswer.upsert({
          where: {
            applicationId_questionId: {
              applicationId,
              questionId: answer.questionId,
            },
          },
          update: {
            selectedOptionId: answer.selectedOptionId ?? null,
            essayAnswer: answer.essayAnswer ?? null,
          },
          create: {
            applicationId,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId ?? null,
            essayAnswer: answer.essayAnswer ?? null,
          },
        });
      }

      // 2. Mark application as TAKEN
      await tx.entranceExamApplication.update({
        where: { id: applicationId },
        data: { status: "TAKEN" },
      });

      // 3. Create the Score Record with the Auto-Graded MCQ
      await tx.entranceExamScore.upsert({
        where: { applicationId },
        update: { multipleChoiceScore: mcqCorrect },
        create: {
          applicationId,
          multipleChoiceScore: mcqCorrect,
          status: "PENDING",
        },
      });

      return { success: true, mcqScore: mcqCorrect };
    });
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
    return prisma.examQuestion.delete({
      where: { id },
    });
  }
}

function questionDataForValidation(data: ExamQuestionInput): Omit<ExamQuestionInput, "options"> {
  return {
    questionText: data.questionText, questionTextEmphasis: data.questionTextEmphasis, type: data.type, order: data.order,
    stimulusType: data.stimulusType, stimulusMediaId: data.stimulusMediaId,
    structuredStimulus: data.structuredStimulus, structuredStimulusEmphasis: data.structuredStimulusEmphasis,
  };
}
