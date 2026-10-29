import type { Prisma } from "@prisma/client";
import type { AdminExamQuestion, ApplicantExamQuestion } from "../interfaces/exam-content.interfaces";
import { examMediaId, validateStructuredStimulus } from "../services/exam-content.rules";

const questionFields = {
  id: true, questionText: true, type: true, order: true,
  stimulusType: true, stimulusMediaId: true, structuredStimulus: true,
} as const;
const optionFields = {
  id: true, questionId: true, optionText: true, label: true, order: true, mediaId: true,
} as const;

export const applicantQuestionSelect = {
  ...questionFields,
  options: { orderBy: [{ order: "asc" }, { id: "asc" }], select: optionFields },
} satisfies Prisma.ExamQuestionSelect;

export const adminQuestionSelect = {
  ...questionFields,
  options: { orderBy: [{ order: "asc" }, { id: "asc" }], select: { ...optionFields, isCorrect: true } },
} satisfies Prisma.ExamQuestionSelect;

type ApplicantRow = Prisma.ExamQuestionGetPayload<{ select: typeof applicantQuestionSelect }>;
type AdminRow = Prisma.ExamQuestionGetPayload<{ select: typeof adminQuestionSelect }>;

/** Explicit output allowlist, even when the caller happens to hold a wider row. */
export function toApplicantQuestion(row: ApplicantRow): ApplicantExamQuestion {
  return {
    id: row.id, questionText: row.questionText, type: row.type, order: row.order,
    stimulusType: row.stimulusType,
    stimulusMediaId: row.stimulusType === "IMAGE" ? examMediaId(row.stimulusMediaId) : null,
    structuredStimulus: row.stimulusType === "STRUCTURED" ? validateStructuredStimulus(row.structuredStimulus) : null,
    options: row.options.map(opt => ({
      id: opt.id, questionId: opt.questionId, optionText: opt.optionText,
      label: opt.label, order: opt.order, mediaId: examMediaId(opt.mediaId),
    })),
  };
}

export function toAdminQuestion(row: AdminRow): AdminExamQuestion {
  const safe = toApplicantQuestion(row);
  return { ...safe, options: safe.options.map((opt, index) => ({ ...opt, isCorrect: row.options[index].isCorrect })) };
}
