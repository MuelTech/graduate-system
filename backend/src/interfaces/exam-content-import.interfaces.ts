import type { ExamQuestionInput } from "./exam-content.interfaces";

export interface ExamPackageCounts {
  questionsValidated: number;
  textOnlyQuestions: number;
  structuredStimulusQuestions: number;
  imageStimulusQuestions: number;
  visualOptions: number;
  sourceFiles: number;
  assets: number;
  questionTypes: Record<string, number>;
  stimulusTypes: Record<string, number>;
  structuredSubtypes: Record<string, number>;
}

/** Internal preflight snapshot only; source paths/bytes never enter question DTOs. */
export interface PreparedExamQuestion {
  sourceQuestionNumber: number;
  input: ExamQuestionInput;
  stimulusAsset: string | null;
  optionAssets: (string | null)[];
}

export interface PreparedExamPackage {
  packageKey: "olsat";
  fingerprint: string;
  questions: PreparedExamQuestion[];
  assets: Map<string, Buffer>;
  counts: ExamPackageCounts;
}

export interface PersistedExamImportQuestion {
  sourceQuestionNumber: number;
  input: ExamQuestionInput;
}

export interface ExamImportIdentity {
  fingerprint: string;
  questionCount: number;
  actualQuestionCount: number;
}

export interface ExamImportPersistence {
  find(packageKey: string): Promise<ExamImportIdentity | null>;
  commit(packageKey: string, fingerprint: string, questions: PersistedExamImportQuestion[]): Promise<void>;
}

export interface ExamImportMedia {
  createImage(bytes: Buffer): Promise<{ id: string }>;
  discardUnreferencedImage(id: string): Promise<boolean>;
}

export interface ExamImportSummary extends ExamPackageCounts {
  status: "PREFLIGHT_OK" | "IMPORTED" | "ALREADY_IMPORTED";
  questionsImported: number;
  mediaObjectsCreated: number;
}

export interface ExamImportCleanup { removed: number; retained: number; failed: number }

export class ExamContentImportError extends Error {
  constructor(
    public readonly code: "INVALID_PACKAGE" | "SOURCE_CONFLICT" | "IMPORT_FAILED",
    message: string,
    public readonly cleanup?: ExamImportCleanup,
  ) { super(message); this.name = "ExamContentImportError"; }
}
