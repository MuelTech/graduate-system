import type { ExamOption } from "../types";
import { optionLabel } from "./exam-content";

export interface ApplicantOptionView extends ExamOption {
  displayLabel: string;
  selected: boolean;
  select: () => void;
}

/** Copy and order only Applicant content; incidental server fields are discarded. */
export function applicantOptionViews(
  options: readonly ExamOption[],
  selectedOptionId: string | undefined,
  onSelect: (optionId: string) => void,
): ApplicantOptionView[] {
  return options
    .map((option) => ({
      id: option.id,
      questionId: option.questionId,
      label: option.label,
      order: option.order,
      optionText: option.optionText,
      mediaId: option.mediaId,
      displayLabel: optionLabel(option),
      selected: selectedOptionId === option.id,
      select: () => onSelect(option.id),
    }))
    .sort(
      (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** The existing page-state update, retaining every other question's selection. */
export function withApplicantAnswer(
  answers: Readonly<Record<string, string>>,
  questionId: string,
  selectedOptionId: string,
): Record<string, string> {
  return { ...answers, [questionId]: selectedOptionId };
}
