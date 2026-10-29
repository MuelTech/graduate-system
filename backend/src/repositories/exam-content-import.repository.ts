import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { validateExamQuestion } from "../services/exam-content.rules";
import type { ExamImportPersistence, PersistedExamImportQuestion } from "../interfaces/exam-content-import.interfaces";

/** The import identity and every question/option commit together, or all roll back. */
export class ExamContentImportRepository implements ExamImportPersistence {
  async find(packageKey: string) {
    const row = await prisma.examContentImport.findUnique({
      where: { id: packageKey },
      select: { fingerprint: true, questionCount: true, _count: { select: { questions: true } } },
    });
    return row ? { fingerprint: row.fingerprint, questionCount: row.questionCount, actualQuestionCount: row._count.questions } : null;
  }

  async commit(packageKey: string, fingerprint: string, questions: PersistedExamImportQuestion[]): Promise<void> {
    const validated = questions.map(item => ({ ...item, input: validateExamQuestion(item.input) }));
    await prisma.$transaction(async tx => {
      // Unique package identity also serializes competing imports at commit.
      await tx.examContentImport.create({ data: { id: packageKey, fingerprint, questionCount: validated.length } });
      for (const { sourceQuestionNumber, input } of validated) {
        await tx.examQuestion.create({
          data: {
            sourceImportId: packageKey, sourceQuestionNumber,
            questionText: input.questionText, type: input.type, order: input.order,
            stimulusType: input.stimulusType, stimulusMediaId: input.stimulusMediaId,
            structuredStimulus: input.structuredStimulus === null ? Prisma.DbNull : input.structuredStimulus as Prisma.InputJsonValue,
            options: { create: input.options.map(opt => ({
              optionText: opt.optionText, label: opt.label, order: opt.order,
              mediaId: opt.mediaId, isCorrect: opt.isCorrect,
            })) },
          },
          select: { id: true },
        });
      }
    }, { maxWait: 10000, timeout: 60000 });
  }
}
