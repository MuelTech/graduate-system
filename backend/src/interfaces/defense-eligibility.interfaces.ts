export type DefenseStage = "TITLE" | "PROPOSAL" | "FINAL";

export type MissingRequirementCode =
  | "COMP_EXAM_PASSED"
  | "COMP_EXAM_DISMISSED"
  | "STUDENT_NOT_FOUND"
  | "ACTIVE_ADVISER"
  | "NO_ACTIVE_THESIS"
  | "THESIS_STAGE"
  | "THESIS_NOT_APPROVED"
  | "THREE_TITLES"
  | "CONCEPT_PAPER"
  | "PROPOSAL_CHAPTERS"
  | "FINAL_MANUSCRIPT"
  | "COR"
  | "RECEIPT"
  | "ADVISER_CERT"
  | "PRIOR_RAP"
  | "RESEARCH_VARIABLES"
  | "INSTRUMENTS"
  | "STATISTICIAN_CERT"
  | "PLAGIARISM_ELIGIBLE";

export interface MissingRequirement {
  code: MissingRequirementCode;
  message: string;
  stage: DefenseStage;
}

export interface EligibilityResult {
  eligible: boolean;
  missing: MissingRequirement[];
}

export const DEFENSE_TYPE_STAGE = {
  TITLE_DEFENSE: "TITLE",
  PROPOSAL_DEFENSE: "PROPOSAL",
  FINAL_DEFENSE: "FINAL",
} as const;

export type DefenseTypeName = keyof typeof DEFENSE_TYPE_STAGE;

export interface EligibilitySnapshot {
  studentId: string | null;
  thesisId: string | null;
  thesisStage: DefenseStage | null;
  thesisStatus: string | null;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  activeAdviser: boolean;
  titleCount: number;
  conceptPaper: boolean;
  proposalChapters: boolean;
  finalManuscript: boolean;
  cor: boolean;
  receipt: boolean;
  adviserCertIssued: boolean;
  titleRapSigned: boolean;
  proposalRapSigned: boolean;
  researchVariablesApproved: boolean;
  instruments: boolean;
  statisticianCert: boolean;
  plagiarismEligible: boolean;
}
