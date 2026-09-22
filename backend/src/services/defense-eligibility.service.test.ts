import { describe, expect, it } from "vitest";
import {
  DEFENSE_TYPE_STAGE,
  type EligibilitySnapshot,
  type MissingRequirement,
} from "../interfaces/defense-eligibility.interfaces";
import {
  DefenseEligibilityService,
  type ApplyTitleEligibilityInput,
} from "./defense-eligibility.service";

const baseSnap = (): EligibilitySnapshot => ({
  studentId: "s1",
  thesisId: "t1",
  thesisStage: "TITLE",
  thesisStatus: "PENDING",
  compExamPassed: true,
  compExamDismissed: false,
  activeAdviser: true,
  titleCount: 3,
  conceptPaper: true,
  proposalChapters: true,
  finalManuscript: true,
  cor: true,
  receipt: true,
  adviserCertIssued: true,
  titleRapSigned: true,
  proposalRapSigned: true,
  researchVariablesApproved: true,
  instruments: true,
  statisticianCert: true,
  plagiarismEligible: true,
});

const titleInput = (
  over: Partial<ApplyTitleEligibilityInput> = {},
): ApplyTitleEligibilityInput => ({
  studentExists: true,
  compExamPassed: true,
  compExamDismissed: false,
  hasActiveThesisBlocking: false,
  titleCountFromRequest: 3,
  hasConceptPaper: true,
  hasCor: true,
  hasReceipt: true,
  ...over,
});

const codes = (m: MissingRequirement[]) => m.map((x) => x.code);

describe("evaluateApplyTitle", () => {
  const svc = new DefenseEligibilityService();

  it("allows title apply WITHOUT adviser (client rule)", () => {
    const result = svc.evaluateApplyTitle(titleInput());
    expect(result.eligible).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("requires comprehensive exam PASSED", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({ compExamPassed: false }),
    );
    expect(result.eligible).toBe(false);
    expect(codes(result.missing)).toContain("COMP_EXAM_PASSED");
  });

  it("blocks dismissed students (2 strikes)", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({ compExamDismissed: true }),
    );
    expect(codes(result.missing)).toContain("COMP_EXAM_DISMISSED");
  });

  it("requires three titles and files", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({
        titleCountFromRequest: 2,
        hasConceptPaper: false,
        hasCor: false,
        hasReceipt: false,
      }),
    );
    expect(codes(result.missing)).toEqual(
      expect.arrayContaining([
        "THREE_TITLES",
        "CONCEPT_PAPER",
        "COR",
        "RECEIPT",
      ]),
    );
  });
});

describe("evaluateApplyProposal", () => {
  const svc = new DefenseEligibilityService();

  it("requires title PASSED and proposal matrix", () => {
    const ok = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PENDING",
      adviserCertIssued: false,
      titleRapSigned: false,
      researchVariablesApproved: false,
    });
    expect(bad.eligible).toBe(false);
    expect(codes(bad.missing)).toEqual(
      expect.arrayContaining([
        "THESIS_STAGE",
        "ADVISER_CERT",
        "PRIOR_RAP",
        "RESEARCH_VARIABLES",
      ]),
    );
  });

  it("requires active adviser for proposal", () => {
    const result = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
      activeAdviser: false,
    });
    expect(codes(result.missing)).toContain("ACTIVE_ADVISER");
  });
});

describe("evaluateApplyFinal", () => {
  const svc = new DefenseEligibilityService();

  it("requires proposal PASSED, plagiarism, statistician, instruments", () => {
    const ok = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "PASSED",
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "APPROVED",
      plagiarismEligible: false,
      statisticianCert: false,
      instruments: false,
      proposalRapSigned: false,
    });
    expect(codes(bad.missing)).toEqual(
      expect.arrayContaining([
        "THESIS_STAGE",
        "PLAGIARISM_ELIGIBLE",
        "STATISTICIAN_CERT",
        "INSTRUMENTS",
        "PRIOR_RAP",
      ]),
    );
  });
});

describe("evaluateSchedule", () => {
  const svc = new DefenseEligibilityService();

  it("requires APPROVED thesis and matching stage", () => {
    const ok = svc.evaluateSchedule(
      {
        ...baseSnap(),
        thesisStage: "TITLE",
        thesisStatus: "APPROVED",
        adviserCertIssued: false,
        titleRapSigned: false,
        proposalRapSigned: false,
        researchVariablesApproved: false,
        instruments: false,
        statisticianCert: false,
        plagiarismEligible: false,
        activeAdviser: false,
      },
      "TITLE_DEFENSE",
    );
    expect(ok.eligible).toBe(true);

    const notApproved = svc.evaluateSchedule(
      { ...baseSnap(), thesisStatus: "PENDING" },
      "TITLE_DEFENSE",
    );
    expect(codes(notApproved.missing)).toContain("THESIS_NOT_APPROVED");

    const wrongStage = svc.evaluateSchedule(
      { ...baseSnap(), thesisStage: "PROPOSAL", thesisStatus: "APPROVED" },
      "TITLE_DEFENSE",
    );
    expect(codes(wrongStage.missing)).toContain("THESIS_STAGE");
  });

  it("maps defense type to stage via DEFENSE_TYPE_STAGE", () => {
    expect(DEFENSE_TYPE_STAGE.FINAL_DEFENSE).toBe("FINAL");
  });
});

describe("assertEligible", () => {
  const svc = new DefenseEligibilityService();

  it("throws when missing is non-empty", () => {
    expect(() =>
      svc.assertEligible({
        eligible: false,
        missing: [
          {
            code: "COMP_EXAM_PASSED",
            message: "Comprehensive Exam must be PASSED.",
            stage: "TITLE",
          },
        ],
      }),
    ).toThrowError(/requirements not met/i);
  });
});
