import { describe, expect, it } from "vitest";
import {
  evaluateActiveAdviserGate,
  evaluateCertifyGate,
  evaluateRequestChangesGate,
  evaluateSubmitManuscriptGate,
  isAllowedProposalManuscriptMime,
  isProposalAdviserCertIssued,
  isProposalStageCert,
  isValidCertifiedProposalManuscript,
  mapCertStatusToReviewStatus,
  resolveCurrentProposalApplicationDocuments,
  selectCertifiedProposalManuscript,
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
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasRemarks: false,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "ISSUED",
        hasRemarks: true,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: false,
        reviewStatus: "AWAITING_REVIEW",
        hasRemarks: true,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
  });

  it("Test 7/8: certify and request changes only from AWAITING_REVIEW", () => {
    // CHANGES_REQUESTED cannot certify (Test 7)
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "CHANGES_REQUESTED",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: false,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    // CHANGES_REQUESTED cannot request changes again (Test 8)
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "CHANGES_REQUESTED",
        hasRemarks: true,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    // NONE has no active review cycle
    expect(
      evaluateRequestChangesGate({
        isActiveAdviser: true,
        reviewStatus: "NONE",
        hasRemarks: true,
        hasReviewedDocument: true,
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
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "AWAITING_REVIEW",
        hasManuscript: true,
        hasSignature: false,
        alreadyIssued: false,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: true,
        reviewStatus: "ISSUED",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: true,
        hasReviewedDocument: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateCertifyGate({
        isActiveAdviser: false,
        reviewStatus: "AWAITING_REVIEW",
        hasManuscript: true,
        hasSignature: true,
        alreadyIssued: false,
        hasReviewedDocument: true,
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

  it("Test C/D/E: certified manuscript binding must match thesis + Proposal stage", () => {
    const thesisA = "thesis-a";
    const docA = {
      id: "doc-a",
      thesisId: thesisA,
      docType: "PROPOSAL_CHAPTERS",
      defenseStage: "PROPOSAL",
    };
    const cert = {
      status: "ISSUED",
      defenseStage: "PROPOSAL_DEFENSE",
      reviewedDocumentId: "doc-a",
    };

    // Valid binding
    expect(isValidCertifiedProposalManuscript(cert, docA, thesisA)).toBe(true);

    // C: ISSUED without reviewedDocumentId fails closed
    expect(
      isValidCertifiedProposalManuscript(
        { ...cert, reviewedDocumentId: null },
        null,
        thesisA,
      ),
    ).toBe(false);

    // D: wrong-thesis document
    expect(
      isValidCertifiedProposalManuscript(cert, { ...docA, thesisId: "thesis-b" }, thesisA),
    ).toBe(false);

    // E: wrong stage / doc type
    expect(
      isValidCertifiedProposalManuscript(
        cert,
        { ...docA, defenseStage: "FINAL", docType: "FINAL_MANUSCRIPT" },
        thesisA,
      ),
    ).toBe(false);
    expect(
      isValidCertifiedProposalManuscript(
        { ...cert, defenseStage: "FINAL_DEFENSE" },
        docA,
        thesisA,
      ),
    ).toBe(false);
  });

  it("Test 4/5/6: Admin application documents use certified manuscript only", () => {
    const thesisId = "thesis-a";
    const docs = [
      {
        id: "A",
        thesisId,
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
        filePath: "a",
      },
      {
        id: "B",
        thesisId,
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
        filePath: "b",
      },
      {
        id: "C",
        thesisId,
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
        filePath: "c",
      },
      {
        id: "cor",
        thesisId,
        docType: "COR",
        defenseStage: "PROPOSAL",
        filePath: "cor",
      },
      {
        id: "receipt",
        thesisId,
        docType: "RECEIPT",
        defenseStage: "PROPOSAL",
        filePath: "r",
      },
    ];
    const certC = {
      status: "ISSUED",
      defenseStage: "PROPOSAL_DEFENSE",
      reviewedDocumentId: "C",
    };

    // Test 4: only C + COR + RECEIPT
    const current = resolveCurrentProposalApplicationDocuments(docs, certC, thesisId);
    expect(current.map((d) => d.id).sort()).toEqual(["C", "cor", "receipt"]);

    // Test 5: never substitute latest B when A is certified
    const certA = { ...certC, reviewedDocumentId: "A" };
    expect(selectCertifiedProposalManuscript(docs, certA, thesisId)?.id).toBe("A");

    // Test 6: invalid binding fails closed (no random latest substitution)
    expect(
      selectCertifiedProposalManuscript(docs, { ...certC, reviewedDocumentId: null }, thesisId),
    ).toBeNull();
    expect(
      selectCertifiedProposalManuscript(
        docs,
        certC,
        "other-thesis",
      ),
    ).toBeNull();
    const wrongStage = [
      {
        id: "C",
        thesisId,
        docType: "FINAL_MANUSCRIPT",
        defenseStage: "FINAL",
        filePath: "c",
      },
    ];
    expect(selectCertifiedProposalManuscript(wrongStage, certC, thesisId)).toBeNull();
  });
});
