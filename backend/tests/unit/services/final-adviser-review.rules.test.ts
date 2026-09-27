import { describe, expect, it } from "vitest";
import {
  FINAL_MANUSCRIPT_DOC_STAGE,
  FINAL_MANUSCRIPT_DOC_TYPE,
  FINAL_REVIEW_STAGE,
  isValidCertifiedFinalManuscript,
  isValidCertifiedProposalManuscript,
  resolveCurrentFinalApplicationDocuments,
  selectCertifiedFinalManuscript,
} from "../../../src/services/proposal-adviser-review.rules";

const thesisId = "thesis-a";
const finalDoc = {
  id: "doc-c",
  thesisId,
  docType: FINAL_MANUSCRIPT_DOC_TYPE,
  defenseStage: FINAL_MANUSCRIPT_DOC_STAGE,
};
const finalCert = {
  status: "ISSUED",
  defenseStage: FINAL_REVIEW_STAGE,
  reviewedDocumentId: "doc-c",
};

describe("CP4 Final certified manuscript binding", () => {
  it("Test 6/18/19: Final cert requires exact FINAL_MANUSCRIPT/FINAL binding", () => {
    expect(isValidCertifiedFinalManuscript(finalCert, finalDoc, thesisId)).toBe(true);

    // Proposal cert does not satisfy Final
    expect(
      isValidCertifiedFinalManuscript(
        { ...finalCert, defenseStage: "PROPOSAL_DEFENSE" },
        finalDoc,
        thesisId,
      ),
    ).toBe(false);
    // Final cert does not satisfy Proposal
    expect(
      isValidCertifiedProposalManuscript(finalCert, finalDoc, thesisId),
    ).toBe(false);

    // Invalid bindings fail closed
    expect(
      isValidCertifiedFinalManuscript(
        { ...finalCert, reviewedDocumentId: null },
        null,
        thesisId,
      ),
    ).toBe(false);
    expect(
      isValidCertifiedFinalManuscript(
        finalCert,
        { ...finalDoc, docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" },
        thesisId,
      ),
    ).toBe(false);
    expect(
      isValidCertifiedFinalManuscript(finalCert, { ...finalDoc, thesisId: "other" }, thesisId),
    ).toBe(false);
  });

  it("Test 22: Admin Final docs use certified manuscript only", () => {
    const docs = [
      { ...finalDoc, id: "A", filePath: "a" },
      { ...finalDoc, id: "B", filePath: "b" },
      { ...finalDoc, id: "C", filePath: "c" },
      {
        id: "cor",
        thesisId,
        docType: "COR",
        defenseStage: "FINAL",
        filePath: "cor",
      },
      {
        id: "receipt",
        thesisId,
        docType: "RECEIPT",
        defenseStage: "FINAL",
        filePath: "r",
      },
    ];
    const certC = { ...finalCert, reviewedDocumentId: "C" };
    const current = resolveCurrentFinalApplicationDocuments(docs, certC, thesisId);
    expect(current.map((d) => d.id).sort()).toEqual(["C", "cor", "receipt"]);
    expect(selectCertifiedFinalManuscript(docs, certC, thesisId)?.id).toBe("C");
  });
});
