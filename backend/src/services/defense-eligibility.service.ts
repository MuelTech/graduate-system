import {
  DEFENSE_TYPE_STAGE,
  type ApplicationUploadInput,
  type DefenseStage,
  type DefenseTypeName,
  type EligibilityResult,
  type EligibilitySnapshot,
  type MissingRequirement,
  type MissingRequirementCode,
  type ResearchVariablesState,
} from "../interfaces/defense-eligibility.interfaces";
import {
  DEFAULT_FINAL_OPTIONAL_GATES,
  type FinalOptionalGateFlags,
} from "./defense-gates.config";
import { canUnlockFinal, canUnlockProposal } from "./stage-completion";
import { AppError } from "../utils/AppError";

export interface ApplyTitleEligibilityInput {
  studentExists: boolean;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  hasActiveThesisBlocking: boolean;
  titleCountFromRequest: number;
  hasConceptPaper: boolean;
  hasCor: boolean;
  hasReceipt: boolean;
}

function miss(
  code: MissingRequirementCode,
  message: string,
  stage: DefenseStage,
): MissingRequirement {
  return { code, message, stage };
}

/** Research Variables: IF ANY — NOT_APPLICABLE satisfies (§10.3.1). */
export function researchVariablesSatisfied(
  state: ResearchVariablesState,
): boolean {
  return state === "APPROVED" || state === "NOT_APPLICABLE";
}

export class DefenseEligibilityService {
  evaluateApplyTitle(input: ApplyTitleEligibilityInput): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "TITLE";

    if (!input.studentExists) {
      missing.push(
        miss("STUDENT_NOT_FOUND", "Student profile not found.", stage),
      );
    }
    if (input.compExamDismissed) {
      missing.push(
        miss(
          "COMP_EXAM_DISMISSED",
          "Student is dismissed after two Comprehensive Exam failures.",
          stage,
        ),
      );
    }
    if (!input.compExamPassed) {
      missing.push(
        miss(
          "COMP_EXAM_PASSED",
          "Comprehensive Exam must be PASSED before Title Defense application.",
          stage,
        ),
      );
    }
    if (input.hasActiveThesisBlocking) {
      missing.push(
        miss(
          "NO_ACTIVE_THESIS",
          "You already have an active Thesis Record in progress.",
          stage,
        ),
      );
    }
    if (input.titleCountFromRequest < 3) {
      missing.push(
        miss(
          "THREE_TITLES",
          "Three (3) proposed research titles are required.",
          stage,
        ),
      );
    }
    if (!input.hasConceptPaper) {
      missing.push(
        miss(
          "TITLE_PROPOSAL",
          "Title Defense proposal package is required.",
          stage,
        ),
      );
    }
    if (!input.hasCor) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for this Title application is required.",
          stage,
        ),
      );
    }
    if (!input.hasReceipt) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for this Title application is required.",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyProposal(
    snap: EligibilitySnapshot,
    upload: ApplicationUploadInput = {
      manuscript: snap.evidence.proposalChapters,
      cor: snap.evidence.corProposal,
      receipt: snap.evidence.receiptProposal,
    },
  ): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "PROPOSAL";
    const titlePassed = canUnlockProposal({
      thesisStage: snap.thesisStage,
      outcome: snap.thesisOutcome,
      hasSelectedTitle: snap.hasSelectedTitle,
      titleRapFinalized: snap.titleRapSigned,
    });

    if (!snap.compExamPassed) {
      missing.push(
        miss(
          "COMP_EXAM_PASSED",
          "Comprehensive Exam must be PASSED before continuing.",
          stage,
        ),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss(
          "COMP_EXAM_DISMISSED",
          "Student is dismissed (two exam failures).",
          stage,
        ),
      );
    }
    if (!titlePassed) {
      missing.push(
        miss(
          "THESIS_STAGE",
          "Title Defense must be PASSED (with selected title and finalized Title RAP) before Proposal application.",
          stage,
        ),
      );
    }
    if (!snap.activeAdviser) {
      missing.push(
        miss(
          "ACTIVE_ADVISER",
          "An active Thesis Adviser is required for Proposal Defense.",
          stage,
        ),
      );
    }
    if (!snap.adviserCerts.proposal) {
      missing.push(
        miss(
          "ADVISER_CERT",
          "Adviser certification for Proposal Defense must be issued.",
          stage,
        ),
      );
    }
    if (!snap.titleRapSigned) {
      missing.push(
        miss(
          "PRIOR_RAP",
          "Approved (signed) Title Defense RAP Report is required.",
          stage,
        ),
      );
    }
    if (!researchVariablesSatisfied(snap.researchVariables)) {
      missing.push(
        miss(
          "RESEARCH_VARIABLES",
          "Research Variables approval is required when applicable (mark NOT_APPLICABLE if the study has no variables).",
          stage,
        ),
      );
    }
    if (!upload.manuscript && !snap.evidence.proposalChapters) {
      missing.push(
        miss(
          "PROPOSAL_CHAPTERS",
          "Manuscript Chapters 1-3 for Proposal Defense is required.",
          stage,
        ),
      );
    }
    if (!upload.cor && !snap.evidence.corProposal) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for this Proposal application is required.",
          stage,
        ),
      );
    }
    if (!upload.receipt && !snap.evidence.receiptProposal) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for this Proposal application is required.",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyFinal(
    snap: EligibilitySnapshot,
    upload: ApplicationUploadInput = {
      manuscript: snap.evidence.finalManuscript,
      cor: snap.evidence.corFinal,
      receipt: snap.evidence.receiptFinal,
    },
    gates: FinalOptionalGateFlags = DEFAULT_FINAL_OPTIONAL_GATES,
  ): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "FINAL";
    const proposalPassed = canUnlockFinal({
      thesisStage: snap.thesisStage,
      outcome: snap.thesisOutcome,
      proposalRapFinalized: snap.proposalRapSigned,
    });

    if (!snap.compExamPassed) {
      missing.push(
        miss("COMP_EXAM_PASSED", "Comprehensive Exam must be PASSED.", stage),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss(
          "COMP_EXAM_DISMISSED",
          "Student is dismissed (two exam failures).",
          stage,
        ),
      );
    }
    if (!proposalPassed) {
      missing.push(
        miss(
          "THESIS_STAGE",
          "Proposal Defense must be PASSED (with finalized Proposal RAP) before Final application.",
          stage,
        ),
      );
    }
    if (!snap.activeAdviser) {
      missing.push(
        miss(
          "ACTIVE_ADVISER",
          "An active Thesis Adviser is required for Final Defense.",
          stage,
        ),
      );
    }
    if (!snap.adviserCerts.final) {
      missing.push(
        miss(
          "ADVISER_CERT",
          "Adviser certification for Final Defense must be issued.",
          stage,
        ),
      );
    }
    if (!snap.proposalRapSigned) {
      missing.push(
        miss(
          "PRIOR_RAP",
          "Approved (signed) Proposal Defense RAP Report is required.",
          stage,
        ),
      );
    }
    if (!upload.manuscript && !snap.evidence.finalManuscript) {
      missing.push(
        miss(
          "FINAL_MANUSCRIPT",
          "Complete manuscript (preliminaries through Chapters 1-5) is required.",
          stage,
        ),
      );
    }
    if (!upload.cor && !snap.evidence.corFinal) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for this Final application is required.",
          stage,
        ),
      );
    }
    if (!upload.receipt && !snap.evidence.receiptFinal) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for this Final application is required.",
          stage,
        ),
      );
    }

    // CLIENT_CONFIRMATION_REQUIRED — gated, default OFF (§11.2–11.3).
    if (gates.requireInstruments && !snap.evidence.instruments) {
      missing.push(
        miss("INSTRUMENTS", "Research instruments are required.", stage),
      );
    }
    if (gates.requireStatisticianCert && !snap.statisticianCert) {
      missing.push(
        miss(
          "STATISTICIAN_CERT",
          "Statistician certification is required.",
          stage,
        ),
      );
    }
    if (gates.requireStrike && !snap.plagiarismEligible) {
      missing.push(
        miss(
          "PLAGIARISM_ELIGIBLE",
          "STRIKE plagiarism check must be eligible (below configured threshold).",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateSchedule(
    snap: EligibilitySnapshot,
    defenseType: DefenseTypeName,
    gates: FinalOptionalGateFlags = DEFAULT_FINAL_OPTIONAL_GATES,
  ): EligibilityResult {
    const stage = DEFENSE_TYPE_STAGE[defenseType] as DefenseStage;
    const missing: MissingRequirement[] = [];

    if (!snap.studentId || snap.studentId === "unknown") {
      missing.push(
        miss("STUDENT_NOT_FOUND", "Student profile not found.", stage),
      );
    }
    if (snap.thesisStatus !== "APPROVED") {
      missing.push(
        miss(
          "THESIS_NOT_APPROVED",
          "Thesis application must be APPROVED by admin before scheduling.",
          stage,
        ),
      );
    }
    if (snap.thesisStage !== stage) {
      missing.push(
        miss(
          "THESIS_STAGE",
          `Thesis stage must be ${stage} for ${defenseType}.`,
          stage,
        ),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss(
          "COMP_EXAM_DISMISSED",
          "Student is dismissed (two exam failures).",
          stage,
        ),
      );
    }
    if (!snap.compExamPassed) {
      missing.push(
        miss("COMP_EXAM_PASSED", "Comprehensive Exam must be PASSED.", stage),
      );
    }

    // Stage-scoped COR + fee proof (Title receipt must not satisfy Proposal/Final).
    if (stage === "TITLE" && !snap.evidence.corTitle) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for Title Defense is required.",
          stage,
        ),
      );
    }
    if (stage === "PROPOSAL" && !snap.evidence.corProposal) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for Proposal Defense is required.",
          stage,
        ),
      );
    }
    if (stage === "FINAL" && !snap.evidence.corFinal) {
      missing.push(
        miss(
          "COR",
          "Certificate of Registration (COR) for Final Defense is required.",
          stage,
        ),
      );
    }

    if (stage === "TITLE" && !snap.evidence.receiptTitle) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for Title Defense is required.",
          stage,
        ),
      );
    }
    if (stage === "PROPOSAL" && !snap.evidence.receiptProposal) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for Proposal Defense is required.",
          stage,
        ),
      );
    }
    if (stage === "FINAL" && !snap.evidence.receiptFinal) {
      missing.push(
        miss(
          "RECEIPT",
          "Defense-fee proof of payment for Final Defense is required.",
          stage,
        ),
      );
    }

    if (stage === "TITLE") {
      if (snap.titleCount < 3) {
        missing.push(
          miss(
            "THREE_TITLES",
            "Three (3) proposed research titles are required.",
            stage,
          ),
        );
      }
      if (!snap.evidence.titlePackage) {
        missing.push(
          miss(
            "TITLE_PROPOSAL",
            "Title Defense proposal package is required.",
            stage,
          ),
        );
      }
    }

    if (stage === "PROPOSAL") {
      if (!snap.activeAdviser) {
        missing.push(
          miss("ACTIVE_ADVISER", "An active Thesis Adviser is required.", stage),
        );
      }
      if (!snap.adviserCerts.proposal) {
        missing.push(
          miss(
            "ADVISER_CERT",
            "Adviser certification for Proposal Defense is required.",
            stage,
          ),
        );
      }
      if (!snap.titleRapSigned) {
        missing.push(
          miss("PRIOR_RAP", "Signed Title Defense RAP is required.", stage),
        );
      }
      if (!researchVariablesSatisfied(snap.researchVariables)) {
        missing.push(
          miss(
            "RESEARCH_VARIABLES",
            "Research Variables approval is required when applicable (NOT_APPLICABLE is allowed).",
            stage,
          ),
        );
      }
      if (!snap.evidence.proposalChapters) {
        missing.push(
          miss(
            "PROPOSAL_CHAPTERS",
            "Manuscript Chapters 1-3 for Proposal Defense is required.",
            stage,
          ),
        );
      }
    }

    if (stage === "FINAL") {
      if (!snap.activeAdviser) {
        missing.push(
          miss("ACTIVE_ADVISER", "An active Thesis Adviser is required.", stage),
        );
      }
      if (!snap.adviserCerts.final) {
        missing.push(
          miss(
            "ADVISER_CERT",
            "Adviser certification for Final Defense is required.",
            stage,
          ),
        );
      }
      if (!snap.proposalRapSigned) {
        missing.push(
          miss("PRIOR_RAP", "Signed Proposal Defense RAP is required.", stage),
        );
      }
      if (!snap.evidence.finalManuscript) {
        missing.push(
          miss(
            "FINAL_MANUSCRIPT",
            "Final manuscript (preliminaries through Chapters 1-5) is required.",
            stage,
          ),
        );
      }
      if (gates.requireInstruments && !snap.evidence.instruments) {
        missing.push(
          miss("INSTRUMENTS", "Research instruments are required.", stage),
        );
      }
      if (gates.requireStatisticianCert && !snap.statisticianCert) {
        missing.push(
          miss(
            "STATISTICIAN_CERT",
            "Statistician certification is required.",
            stage,
          ),
        );
      }
      if (gates.requireStrike && !snap.plagiarismEligible) {
        missing.push(
          miss(
            "PLAGIARISM_ELIGIBLE",
            "STRIKE plagiarism check must be eligible (below configured threshold).",
            stage,
          ),
        );
      }
    }

    return { eligible: missing.length === 0, missing };
  }

  assertEligible(result: EligibilityResult): void {
    if (!result.eligible) {
      const err = new AppError("Defense requirements not met", 400) as AppError & {
        missing?: MissingRequirement[];
      };
      err.missing = result.missing;
      throw err;
    }
  }
}
