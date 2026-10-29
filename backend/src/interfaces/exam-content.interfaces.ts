/** Structured shapes observed in the verified manifest; no extraction provenance. */
export type ExamCell = string | number;
export type StructuredStimulus =
  | { type: "MATRIX"; rows: ExamCell[][] }
  | { type: "GROUPED_NUMBER_ROWS"; groups: ExamCell[][] }
  | { type: "NUMBER_SEQUENCE"; items: ExamCell[] }
  | { type: "WORD_BANK" | "ALPHANUMERIC_SEQUENCE" | "WORD_SERIES" | "LETTER_SEQUENCE" | "LOGICAL_PREMISES"; items: string[] };

export interface ExamOptionInput {
  /** Absent for legacy clients; provided IDs preserve existing option identity. */
  id?: string;
  optionText: string | null;
  label: string | null;
  order: number;
  mediaId: string | null;
  isCorrect: boolean;
}

export interface ExamQuestionInput {
  questionText: string;
  type: "MULTIPLE_CHOICE" | "ESSAY";
  order: number;
  stimulusType: "NONE" | "IMAGE" | "STRUCTURED";
  stimulusMediaId: string | null;
  structuredStimulus: StructuredStimulus | null;
  options: ExamOptionInput[];
}

export interface ApplicantExamOption extends Omit<ExamOptionInput, "isCorrect" | "id"> {
  id: string;
  questionId: string;
}

export interface ApplicantExamQuestion extends Omit<ExamQuestionInput, "options"> {
  id: string;
  options: ApplicantExamOption[];
}

export interface AdminExamQuestion extends Omit<ApplicantExamQuestion, "options"> {
  options: (ApplicantExamOption & { isCorrect: boolean })[];
}
