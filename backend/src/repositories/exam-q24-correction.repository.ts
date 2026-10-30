import prisma from "../config/database";
import type { PreparedExamPackage } from "../interfaces/exam-content-import.interfaces";
import {
  planQ24Correction,
  Q24_CORRECTION,
} from "../services/exam-q24-correction.service";

export class ExamQ24CorrectionRepository {
  async reconcile(source: PreparedExamPackage, apply: boolean) {
    return prisma.$transaction(
      async (tx) => {
        const marker = await tx.examContentImport.findUnique({
          where: { id: "olsat" },
        });
        const rows = await tx.examQuestion.findMany({
          include: { options: true },
        });
        const mediaIds = new Set(
          (await tx.examMedia.findMany({ select: { id: true } })).map(
            (m) => m.id,
          ),
        );
        const plan = planQ24Correction(source, rows, marker, mediaIds);
        if (!apply || plan.corrected)
          return {
            status: apply ? "ALREADY_RECONCILED" : "PREFLIGHT_OK",
            optionRowsChanged: 0,
            importMarkersChanged: 0,
            wouldChange: !plan.corrected,
          };
        const option = await tx.examOption.updateMany({
          where: {
            id: plan.optionId,
            questionId: plan.questionId,
            label: "J",
            order: 3,
            optionText: Q24_CORRECTION.oldText,
            isCorrect: plan.isCorrect,
            mediaId: null,
          },
          data: { optionText: Q24_CORRECTION.newText },
        });
        if (option.count !== 1)
          throw new Error("Q24 option changed during reconciliation.");
        const identity = await tx.examContentImport.updateMany({
          where: {
            id: "olsat",
            fingerprint: Q24_CORRECTION.oldFingerprint,
            questionCount: 72,
          },
          data: { fingerprint: Q24_CORRECTION.newFingerprint },
        });
        if (identity.count !== 1)
          throw new Error("Import identity changed during reconciliation.");
        return {
          status: "RECONCILED",
          optionRowsChanged: 1,
          importMarkersChanged: 1,
          wouldChange: false,
        };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 60000 },
    );
  }
}
