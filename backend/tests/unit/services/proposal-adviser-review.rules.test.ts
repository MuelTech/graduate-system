import { describe, expect, it } from "vitest";
import {
  evaluateActiveAdviserGate,
  evaluateCertifyGate,
  evaluateRequestChangesGate,
  evaluateSubmitManuscriptGate,
  isAllowedProposalManuscriptMime,
  isProposalAdviserCertIssued,
  isProposalStageCert,
  mapCertStatusToReviewStatus,
} from "../../../src/services/proposal-adviser-review.rules";

describe("proposal-adviser-review.rules", () => {
  it("maps cert status to review status", () => {
    expect(mapCertStatusToReviewStatus("AWAITING_REVIEW")).toBe("AWAITING_REVIEW");
    expect(mapCertStatusToReviewStatus("PENDING")).toBe("AWAITING_REVIEW");
    expect(mapCertStatusToReviewStatus("CHANGES_REQUESTED")).toBe("CHANGES_REQUESTED");
    expect(mapCertStatusToReviewStatus("ISSUED")).toBe("ISSUED");
    expect(mapCertStatusToReviewStatus(null)).toBe("NONE");
  });

  it("only ISSUED PROPOSAL_DEFENSE certs satisfy ADVISER_CERT", () => {
    expect(
      isProposalAdviserCertIssued({
        status: "ISSUED",
        defenseStage: "PROPOSAL_DEFENSE",
      }),
    ).toBe(true);
    expect(
      isProposalAdviserCertIssued({
        status: "CHANGES_REQUESTED",
        defenseStage: "PROPOSAL_DEFENSE",
      }),
    ).toBe(false);
    expect(
      isProposalAdviserCertIssued({
        status: "ISSUED",
        defenseStage: "FINAL_DEFENSE",
      }),
    ).toBe(false);
    expect(isProposalStageCert({ defenseStage: "PROPOSAL_DEFENSE" })).toBe(true);
    expect(isProposalStageCert({ defenseStage: "FINAL_DEFENSE" })).toBe(false);
  });

  it("active adviser gate rejects non-adviser", () => {
    expect(
      evaluateActiveAdviserGate({
        isAuthenticated: true,
        isActiveAdviserForStudent: false,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateActiveAdviserGate({
        isAuthenticated: true,
        isActiveAdviserForStudent: true,
      }).allowed,
    ).toBe(true);
  });

  it("manuscript submit requires active adviser + title complete + file", () => {
    expect(
      evaluateSubmitManuscriptGate({
        hasActiveAdviser: false,
        titleStageComplete: true,
        hasManuscriptFile: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateSubmitManuscriptGate({
        hasActiveAdviser: true,
        titleStageComplete: false,
        hasManuscriptFile: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateSubmitManuscriptGate({
        hasActiveAdviser: true,
        titleStageComplete: true,
        hasManuscriptFile: false,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateSubmitManuscriptGate({
        hasActiveAdviser: true,
        titleStageComplete: true,
        hasManuscriptFile: true,
      }).allowed,
    ).toBe(true);
  });

  it("request changes requires remarks and blocks ISSUED", () => {
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasRemarks: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasRemarks: false,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "ISSUED",
        hasRemarks: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: false,
        reviewStatus: "AWAITING_REVIEW",
        hasRemarks: true,
      }).allowed,
    ).toBe(false);
  });

  it("certify requires signature, manuscript, and blocks duplicates", () => {
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: false,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasManuscript: true,
        hasSignature: false,
        alreadyIssued: false,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "ISSUED",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: false,
        reviewStatus: "AWAITING_REVIEW",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: false,
      }).allowed,
    ).toBe(false);
  });

  it("allows pdf/doc/docx manuscript mime types", () => {
    expect(isAllowedProposalManuscriptMime("application/pdf")).toBe(true);
    expect(isAllowedProposalManuscriptMime("application/msword")).toBe(true);
    expect(
      isAllowedProposalManuscriptMime(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(isAllowedProposalManuscriptMime("image/png")).toBe(false);
  });
});
