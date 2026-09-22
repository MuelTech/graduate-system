import { describe, expect, it } from "vitest";
import {
  DEFENSE_TYPE_STAGE,
  type EligibilitySnapshot,
  type MissingRequirement,
} from "../interfaces/defense-eligibility.interfaces";
import {
  DefenseEligibilityService,
  researchVariablesSatisfied,
  type ApplyTitleEligibilityInput,
} from "./defense-eligibility.service";
import { DEFAULT_FINAL_OPTIONAL_GATES } from "./defense-gates.config";

const baseSnap = (): EligibilitySnapshot => ({
  studentId: "s1",
  thesisId: "t1",
  thesisStage: "TITLE",
  thesisStatus: "PENDING",
  thesisOutcome: null,
  hasSelectedTitle: false,
  compExamPassed: true,
  compExamDismissed: false,
  activeAdviser: true,
  titleCount: 3,
  evidence: {
    titlePackage: true,
    proposalChapters: true,
    finalManuscript: true,
    corTitle: true,
    corProposal: true,
    corFinal: true,
    receiptTitle: true,
    receiptProposal: true,
    receiptFinal: true,
    instruments: true,
  },
  adviserCerts: { proposal: true, final: true },
  titleRapSigned: true,
  proposalRapSigned: true,
  researchVariables: "APPROVED",
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

  it("requires three titles and stage-scoped files", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({
        titleCountFromRequest: 2,
        hasConceptPaper: false,
        hasCor: false,
        hasReceipt: false,
      }),
    );
    expect(codes(result.missing)).toEqual(
      expect.arrayContaining(["THREE_TITLES", "TITLE_PROPOSAL", "COR", "RECEIPT"]),
    );
  });
});

describe("evaluateApplyProposal", () => {
  const svc = new DefenseEligibilityService();

  it("requires title PASSED outcome and proposal matrix", () => {
    const ok = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
      thesisOutcome: "PASSED",
      hasSelectedTitle: true,
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PENDING",
      thesisOutcome: null,
      adviserCerts: { proposal: false, final: true },
      titleRapSigned: false,
      researchVariables: "NONE",
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

  it("does not unlock Proposal from REVISION_REQUIRED or APPROVED-without-outcome", () => {
    const revision = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "REVISION",
      thesisOutcome: "REVISION_REQUIRED",
      hasSelectedTitle: true,
    });
    expect(codes(revision.missing)).toContain("THESIS_STAGE");

    const approvedOnly = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "APPROVED",
      thesisOutcome: null,
      hasSelectedTitle: true,
    });
    expect(codes(approvedOnly.missing)).toContain("THESIS_STAGE");
  });

  it("accepts Research Variables NOT_APPLICABLE", () => {
    expect(researchVariablesSatisfied("NOT_APPLICABLE")).toBe(true);
    expect(researchVariablesSatisfied("APPROVED")).toBe(true);
    expect(researchVariablesSatisfied("PENDING")).toBe(false);
    expect(researchVariablesSatisfied("NONE")).toBe(false);

    const result = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisOutcome: null,
      researchVariables: "NOT_APPLICABLE",
    });
    expect(result.eligible).toBe(true);
  });

  it("requires stage-scoped COR and fee proof (Title receipt is not enough)", () => {
    const result = svc.evaluateApplyProposal(
      {
        ...baseSnap(),
        thesisStage: "TITLE",
        thesisOutcome: "PASSED",
        hasSelectedTitle: true,
        evidence: {
          ...baseSnap().evidence,
          corProposal: false,
          receiptProposal: false,
          corTitle: true,
          receiptTitle: true,
        },
      },
      { manuscript: true, cor: false, receipt: false },
    );
    expect(codes(result.missing)).toEqual(
      expect.arrayContaining(["COR", "RECEIPT"]),
    );
  });

  it("requires active adviser for proposal", () => {
    const result = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
      thesisOutcome: "PASSED",
      hasSelectedTitle: true,
      activeAdviser: false,
    });
    expect(codes(result.missing)).toContain("ACTIVE_ADVISER");
  });
});

describe("evaluateApplyFinal", () => {
  const svc = new DefenseEligibilityService();

  it("requires proposal PASSED outcome and confirmed Final matrix only", () => {
    const ok = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "PASSED",
      thesisOutcome: "PASSED",
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "APPROVED",
      thesisOutcome: null,
      adviserCerts: { proposal: true, final: false },
      proposalRapSigned: false,
    });
    expect(codes(bad.missing)).toEqual(
      expect.arrayContaining(["THESIS_STAGE", "ADVISER_CERT", "PRIOR_RAP"]),
    );
  });

  it("does NOT block Final on STRIKE/statistician/instruments by default", () => {
    const result = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisOutcome: "PASSED",
      evidence: { ...baseSnap().evidence, instruments: false },
      statisticianCert: false,
      plagiarismEligible: false,
    });
    expect(result.eligible).toBe(true);
  });

  it("blocks Final on those gates only when config enables them", () => {
    const result = svc.evaluateApplyFinal(
      {
        ...baseSnap(),
        thesisStage: "PROPOSAL",
        thesisOutcome: "PASSED",
        evidence: { ...baseSnap().evidence, instruments: false },
        statisticianCert: false,
        plagiarismEligible: false,
      },
      { manuscript: true, cor: true, receipt: true },
      {
        requireInstruments: true,
        requireStatisticianCert: true,
        requireStrike: true,
      },
    );
    expect(codes(result.missing)).toEqual(
      expect.arrayContaining([
        "INSTRUMENTS",
        "STATISTICIAN_CERT",
        "PLAGIARISM_ELIGIBLE",
      ]),
    );
  });

  it("Proposal adviser cert does not satisfy Final cert", () => {
    const result = svc.evaluateApplyFinal(
      {
        ...baseSnap(),
        thesisStage: "PROPOSAL",
        thesisOutcome: "PASSED",
        adviserCerts: { proposal: true, final: false },
      },
      { manuscript: true, cor: true, receipt: true },
      DEFAULT_FINAL_OPTIONAL_GATES,
    );
    expect(codes(result.missing)).toContain("ADVISER_CERT");
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
        adviserCerts: { proposal: false, final: false },
        titleRapSigned: false,
        proposalRapSigned: false,
        researchVariables: "NONE",
        evidence: {
          ...baseSnap().evidence,
          instruments: false,
        },
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
      svc.assertEligible({ eligible: false, missing: [
        { code: "COR", message: "x", stage: "TITLE" },
      ] }),
    ).toThrow();
  });
});
