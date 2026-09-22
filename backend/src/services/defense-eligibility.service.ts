import {
  DEFENSE_TYPE_STAGE,
  type DefenseStage,
  type DefenseTypeName,
  type EligibilityResult,
  type EligibilitySnapshot,
  type MissingRequirement,
  type MissingRequirementCode,
} from "../interfaces/defense-eligibility.interfaces";
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
      missing.push(miss("CONCEPT_PAPER", "Concept paper is required.", stage));
    }
    if (!input.hasCor) {
      missing.push(
        miss("COR", "Certificate of Registration (COR) is required.", stage),
      );
    }
    if (!input.hasReceipt) {
      missing.push(
        miss(
          "RECEIPT",
          "Application receipt / proof of payment is required.",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyProposal(snap: EligibilitySnapshot): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "PROPOSAL";
    const titlePassed =
      (snap.thesisStage === "TITLE" && snap.thesisStatus === "PASSED") ||
      snap.thesisStage === "PROPOSAL" ||
      snap.thesisStage === "FINAL";

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
          "Title Defense must be PASSED before Proposal application.",
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
    if (!snap.adviserCertIssued) {
      missing.push(
        miss(
          "ADVISER_CERT",
          "Adviser certification must be issued for Proposal Defense.",
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
    if (!snap.researchVariablesApproved) {
      missing.push(
        miss(
          "RESEARCH_VARIABLES",
          "Approved research variables (panel-signed) are required.",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyFinal(snap: EligibilitySnapshot): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "FINAL";
    const proposalPassed =
      (snap.thesisStage === "PROPOSAL" && snap.thesisStatus === "PASSED") ||
      snap.thesisStage === "FINAL";

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
          "Proposal Defense must be PASSED before Final application.",
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
    if (!snap.adviserCertIssued) {
      missing.push(
        miss(
          "ADVISER_CERT",
          "Adviser certification must be issued for Final Defense.",
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
    if (!snap.instruments) {
      missing.push(
        miss("INSTRUMENTS", "Research instruments are required.", stage),
      );
    }
    if (!snap.statisticianCert) {
      missing.push(
        miss("STATISTICIAN_CERT", "Statistician certification is required.", stage),
      );
    }
    if (!snap.plagiarismEligible) {
      missing.push(
        miss(
          "PLAGIARISM_ELIGIBLE",
          "STRIKE plagiarism check must be below 20% similarity (eligible).",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateSchedule(
    snap: EligibilitySnapshot,
    defenseType: DefenseTypeName,
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
    if (!snap.cor) {
      missing.push(
        miss("COR", "Certificate of Registration (COR) is required.", stage),
      );
    }
    if (!snap.receipt) {
      missing.push(
        miss(
          "RECEIPT",
          "Application receipt / proof of payment is required.",
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
      if (!snap.conceptPaper) {
        missing.push(miss("CONCEPT_PAPER", "Concept paper is required.", stage));
      }
    }

    if (stage === "PROPOSAL") {
      if (!snap.activeAdviser) {
        missing.push(
          miss("ACTIVE_ADVISER", "An active Thesis Adviser is required.", stage),
        );
      }
      if (!snap.adviserCertIssued) {
        missing.push(
          miss("ADVISER_CERT", "Adviser certification is required.", stage),
        );
      }
      if (!snap.titleRapSigned) {
        missing.push(
          miss("PRIOR_RAP", "Signed Title Defense RAP is required.", stage),
        );
      }
      if (!snap.researchVariablesApproved) {
        missing.push(
          miss(
            "RESEARCH_VARIABLES",
            "Approved research variables are required.",
            stage,
          ),
        );
      }
      if (!snap.proposalChapters) {
        missing.push(
          miss(
            "PROPOSAL_CHAPTERS",
            "Chapters 1–3 document is required.",
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
      if (!snap.adviserCertIssued) {
        missing.push(
          miss("ADVISER_CERT", "Adviser certification is required.", stage),
        );
      }
      if (!snap.proposalRapSigned) {
        missing.push(
          miss("PRIOR_RAP", "Signed Proposal Defense RAP is required.", stage),
        );
      }
      if (!snap.finalManuscript) {
        missing.push(
          miss(
            "FINAL_MANUSCRIPT",
            "Final manuscript (Chapters 1–5) is required.",
            stage,
          ),
        );
      }
      if (!snap.instruments) {
        missing.push(
          miss("INSTRUMENTS", "Research instruments are required.", stage),
        );
      }
      if (!snap.statisticianCert) {
        missing.push(
          miss(
            "STATISTICIAN_CERT",
            "Statistician certification is required.",
            stage,
          ),
        );
      }
      if (!snap.plagiarismEligible) {
        missing.push(
          miss(
            "PLAGIARISM_ELIGIBLE",
            "STRIKE plagiarism check must be eligible (below 20%).",
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
