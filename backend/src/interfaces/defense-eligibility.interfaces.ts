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
  | "TITLE_PROPOSAL"
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

/**
 * Research Variables are conditional (public Stage #2 guidance: "IF ANY").
 * NOT_APPLICABLE satisfies the requirement when the study has no variables.
 */
export type ResearchVariablesState =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "NOT_APPLICABLE";

export interface StageEvidenceFlags {
  titlePackage: boolean;
  proposalChapters: boolean;
  finalManuscript: boolean;
  corTitle: boolean;
  corProposal: boolean;
  corFinal: boolean;
  receiptTitle: boolean;
  receiptProposal: boolean;
  receiptFinal: boolean;
  instruments: boolean;
}

export interface AdviserCertFlags {
  proposal: boolean;
  final: boolean;
}

export interface EligibilitySnapshot {
  studentId: string | null;
  thesisId: string | null;
  thesisStage: DefenseStage | null;
  thesisStatus: string | null;
  /**
   * Compatibility mirror of ThesisRecord.outcome.
   * Prefer titleOutcome / proposalOutcome for academic unlock decisions.
   */
  thesisOutcome: "PASSED" | "REVISION_REQUIRED" | "FAILED" | null;
  /** Formal Title DefenseConclusion outcome (academic authority for Title). */
  titleOutcome: "PASSED" | "REVISION_REQUIRED" | "FAILED" | null;
  /** Official selected title from Title DefenseConclusion.selectedTitleId. */
  hasSelectedTitle: boolean;
  /** Formal Proposal DefenseConclusion outcome (academic authority for Proposal). */
  proposalOutcome: "PASSED" | "REVISION_REQUIRED" | "FAILED" | null;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  activeAdviser: boolean;
  titleCount: number;
  /** Stage-scoped uploads (never satisfied by a prior-stage file). */
  evidence: StageEvidenceFlags;
  adviserCerts: AdviserCertFlags;
  titleRapSigned: boolean;
  proposalRapSigned: boolean;
  researchVariables: ResearchVariablesState;
  statisticianCert: boolean;
  plagiarismEligible: boolean;
}

/** User-provided files on the current application request. */
export interface ApplicationUploadInput {
  manuscript: boolean;
  cor: boolean;
  receipt: boolean;
}
