import { describe, expect, it } from "vitest";
import {
  isAuthoritativePriorProposalManuscript,
  isValidFinalManuscriptBinding,
  isValidProposalManuscriptBinding,
  isValidCertifiedFinalManuscript,
  selectCertifiedFinalManuscript,
  selectCertifiedProposalManuscript,
} from "../../../src/services/proposal-adviser-review.rules";
import { DefenseEligibilityService } from "../../../src/services/defense-eligibility.service";
import type { EligibilitySnapshot } from "../../../src/interfaces/defense-eligibility.interfaces";

/**
 * DL-7: manuscript versioning must not change certification authority.
 * `isCurrent` marks the version head; only the exact ISSUED
 * `AdviserCertification.reviewedDocumentId` is authoritative.
 */

const thesisId = "thesis-1";

const proposalCert = {
  status: "ISSUED",
  defenseStage: "PROPOSAL_DEFENSE",
  reviewedDocumentId: "v2",
};

const proposalDocs = [
  { id: "v1", thesisId, docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: false },
  { id: "v2", thesisId, docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: false },
  { id: "v3", thesisId, docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true },
] as unknown as Array<{
  id: string;
  thesisId: string;
  docType: string;
  defenseStage: string | null;
}>;

const baseSnapshot = (): EligibilitySnapshot => ({
  studentId: "s1",
  thesisId: "t1",
  thesisStage: "PROPOSAL",
  thesisStatus: "PENDING",
  thesisOutcome: null,
  titleOutcome: "PASSED",
  hasSelectedTitle: true,
  proposalOutcome: null,
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

describe("DL-7 manuscript authority vs isCurrent", () => {
  it("exact reviewedDocumentId wins over a newer current version", () => {
    expect(
      selectCertifiedProposalManuscript(proposalDocs, proposalCert, thesisId)?.id,
    ).toBe("v2");
  });

  it("isCurrent alone never satisfies certification authority", () => {
    expect(
      selectCertifiedProposalManuscript(
        proposalDocs,
        { ...proposalCert, status: "AWAITING_REVIEW" },
        thesisId,
      ),
    ).toBeNull();
    expect(
      selectCertifiedProposalManuscript(
        proposalDocs,
        { ...proposalCert, reviewedDocumentId: null },
        thesisId,
      ),
    ).toBeNull();
  });

  it("Final uses the same exact-binding rule", () => {
    const finalCert = {
      status: "ISSUED",
      defenseStage: "FINAL_DEFENSE",
      reviewedDocumentId: "f2",
    };
    const finalDocs = [
      { id: "f1", thesisId, docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL", isCurrent: false },
      { id: "f2", thesisId, docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL", isCurrent: true },
      { id: "f3", thesisId, docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL", isCurrent: true },
    ] as unknown as Array<{
      id: string;
      thesisId: string;
      docType: string;
      defenseStage: string | null;
    }>;
    expect(selectCertifiedFinalManuscript(finalDocs, finalCert, thesisId)?.id).toBe("f2");
    expect(
      isValidCertifiedFinalManuscript(finalCert, finalDocs[1], thesisId),
    ).toBe(true);
  });

  it("CP8 prior-Proposal authority ignores isCurrent and requires the exact binding", () => {
    expect(isAuthoritativePriorProposalManuscript(proposalDocs[1], proposalCert, thesisId)).toBe(true);
    expect(isAuthoritativePriorProposalManuscript(proposalDocs[2], proposalCert, thesisId)).toBe(false);
    expect(isAuthoritativePriorProposalManuscript(proposalDocs[0], proposalCert, thesisId)).toBe(false);
  });

  it("Proposal eligibility requires the ISSUED cert even when a current manuscript exists", () => {
    const svc = new DefenseEligibilityService();
    const snap = baseSnapshot();
    snap.adviserCerts = { proposal: false, final: false };
    snap.evidence = { ...snap.evidence, proposalChapters: true };
    const result = svc.evaluateApplyProposal(snap);
    expect(result.eligible).toBe(false);
    expect(result.missing.map((m) => m.code)).toContain("ADVISER_CERT");
  });
});

describe("DL-7 status-independent manuscript binding identity", () => {
  const cert = {
    status: "AWAITING_REVIEW",
    defenseStage: "PROPOSAL_DEFENSE",
    reviewedDocumentId: "v1",
  };
  const validDoc = {
    id: "v1",
    thesisId,
    docType: "PROPOSAL_CHAPTERS",
    defenseStage: "PROPOSAL",
  };

  it("accepts a valid exact binding without requiring ISSUED", () => {
    expect(isValidProposalManuscriptBinding(cert, validDoc, thesisId)).toBe(true);
    expect(
      isValidProposalManuscriptBinding(
        { ...cert, status: "CHANGES_REQUESTED" },
        validDoc,
        thesisId,
      ),
    ).toBe(true);
  });

  it("rejects unbound / missing document", () => {
    expect(
      isValidProposalManuscriptBinding(
        { ...cert, reviewedDocumentId: null },
        null,
        thesisId,
      ),
    ).toBe(false);
    expect(isValidProposalManuscriptBinding(cert, null, thesisId)).toBe(false);
  });

  it("rejects wrong docType / wrong stage / cross-thesis / wrong id", () => {
    expect(
      isValidProposalManuscriptBinding(cert, { ...validDoc, docType: "COR" }, thesisId),
    ).toBe(false);
    expect(
      isValidProposalManuscriptBinding(cert, { ...validDoc, defenseStage: "FINAL" }, thesisId),
    ).toBe(false);
    expect(
      isValidProposalManuscriptBinding(cert, { ...validDoc, thesisId: "thesis-other" }, thesisId),
    ).toBe(false);
    expect(
      isValidProposalManuscriptBinding(cert, { ...validDoc, id: "v2" }, thesisId),
    ).toBe(false);
  });

  it("rejects wrong certification stage", () => {
    expect(
      isValidProposalManuscriptBinding(
        { ...cert, defenseStage: "FINAL_DEFENSE" },
        validDoc,
        thesisId,
      ),
    ).toBe(false);
  });

  it("Final binding mirrors Proposal identity", () => {
    const fCert = {
      status: "CHANGES_REQUESTED",
      defenseStage: "FINAL_DEFENSE",
      reviewedDocumentId: "f1",
    };
    const fDoc = {
      id: "f1",
      thesisId,
      docType: "FINAL_MANUSCRIPT",
      defenseStage: "FINAL",
    };
    expect(isValidFinalManuscriptBinding(fCert, fDoc, thesisId)).toBe(true);
    expect(
      isValidFinalManuscriptBinding(
        fCert,
        { ...fDoc, docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" },
        thesisId,
      ),
    ).toBe(false);
  });
});
