import type { Prisma } from "@prisma/client";
import type { AdminExamQuestion, ApplicantExamQuestion } from "../interfaces/exam-content.interfaces";
import { examMediaId, validateStructuredStimulus, validatedEmphasis, validatedStructuredEmphasis } from "../services/exam-content.rules";

const questionFields = {
  id: true, questionText: true, questionTextEmphasis: true, type: true, order: true,
  stimulusType: true, stimulusMediaId: true, structuredStimulus: true, structuredStimulusEmphasis: true,
} as const;
const optionFields = {
  id: true, questionId: true, optionText: true, optionTextEmphasis: true, label: true, order: true, mediaId: true,
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
    questionTextEmphasis: validatedEmphasis(row.questionText, row.questionTextEmphasis),
    stimulusType: row.stimulusType,
    stimulusMediaId: row.stimulusType === "IMAGE" ? examMediaId(row.stimulusMediaId) : null,
    structuredStimulus: row.stimulusType === "STRUCTURED" ? validateStructuredStimulus(row.structuredStimulus) : null,
    structuredStimulusEmphasis: validatedStructuredEmphasis(row.stimulusType === "STRUCTURED" ? row.structuredStimulus : null, row.structuredStimulusEmphasis),
    options: row.options.map(opt => ({
      id: opt.id, questionId: opt.questionId, optionText: opt.optionText,
      optionTextEmphasis: validatedEmphasis(opt.optionText, opt.optionTextEmphasis),
      label: opt.label, order: opt.order, mediaId: examMediaId(opt.mediaId),
    })),
  };
}

export function toAdminQuestion(row: AdminRow): AdminExamQuestion {
  const safe = toApplicantQuestion(row);
  return { ...safe, options: safe.options.map((opt, index) => ({ ...opt, isCorrect: row.options[index].isCorrect })) };
}
