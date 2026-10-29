import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import type { ExamQuestionInput } from "../interfaces/exam-content.interfaces";
import { mergeExamQuestionUpdate } from "../services/exam-content.rules";
import { AppError } from "../utils/AppError";
import { applicantQuestionSelect, adminQuestionSelect, toApplicantQuestion, toAdminQuestion } from "./exam-content.projection";

function questionData(data: ExamQuestionInput) {
  return {
    questionText: data.questionText, type: data.type, order: data.order,
    stimulusType: data.stimulusType, stimulusMediaId: data.stimulusMediaId,
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
    questionId: string,
    essayAnswer: string,
  ) {
    return prisma.applicantAnswer.upsert({
      where: {
        applicationId_questionId: {
          applicationId,
          questionId,
        },
      },
      update: { essayAnswer },
      create: { applicationId, questionId, essayAnswer },
    });
  }

  async submitAnswers(applicationId: string, answers: any[]) {
    return prisma.$transaction(async (tx) => {
      const existingApp = await tx.entranceExamApplication.findUnique({ where: { id: applicationId } });
      if (!existingApp || ['TAKEN', 'PASSED', 'FAILED'].includes(existingApp.status)) {
         throw new Error("This exam has already been submitted and cannot be overwritten.");
      }

      let mcqCorrect = 0;

      // 1. Upsert all answers and calculate MCQ Score
      for (const answer of answers) {
        // Check if it's correct
        const question = await tx.examQuestion.findUnique({
          where: { id: answer.questionId },
          include: { options: true },
        });

        if (question?.type === "MULTIPLE_CHOICE") {
          const selectedOpt = question.options.find(
            (o) => o.id === answer.selectedOptionId,
          );
          if (selectedOpt && selectedOpt.isCorrect) {
            mcqCorrect++;
          }
        }

        await tx.applicantAnswer.upsert({
          where: {
            applicationId_questionId: {
              applicationId,
              questionId: answer.questionId,
            },
          },
          update: {
            selectedOptionId: answer.selectedOptionId || null,
            essayAnswer: answer.essayAnswer || null,
          },
          create: {
            applicationId,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId || null,
            essayAnswer: answer.essayAnswer || null,
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
        options: { create: data.options },
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
          if (optionId) await tx.examOption.update({ where: { id: optionId }, data: opt });
          else await tx.examOption.create({ data: { ...opt, questionId: id } });
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
    questionText: data.questionText, type: data.type, order: data.order,
    stimulusType: data.stimulusType, stimulusMediaId: data.stimulusMediaId,
    structuredStimulus: data.structuredStimulus,
  };
}
