import { describe, expect, it } from "vitest";
import {
  STAGE_EVIDENCE_SLOTS,
  isAllowedEvidenceSlot,
  missingRequiredEvidence,
  requiredEvidenceTypes,
  validateCurrentEvidenceCounts,
} from "../../../src/services/defense-evidence.rules";

/**
 * UIUX-4B FIX-1: an authoritative Title Defense application requires three
 * proposed titles + ONE combined Title Defense Proposal Package + Current
 * Semester COR + Defense-fee Proof of Payment. Proposal/Final keep COR + RECEIPT.
 */
describe("defense supporting-evidence stage/type matrix", () => {
  it("TITLE evidence matrix equals TITLE_PROPOSAL + COR + RECEIPT", () => {
    expect(STAGE_EVIDENCE_SLOTS.TITLE).toEqual([
      "TITLE_PROPOSAL",
      "COR",
      "RECEIPT",
    ]);
    expect(STAGE_EVIDENCE_SLOTS.PROPOSAL).toEqual(["COR", "RECEIPT"]);
    expect(STAGE_EVIDENCE_SLOTS.FINAL).toEqual(["COR", "RECEIPT"]);
  });

  it("rejects wrong-stage evidence fields", () => {
    expect(isAllowedEvidenceSlot("PROPOSAL", "TITLE_PROPOSAL")).toBe(false);
    expect(isAllowedEvidenceSlot("FINAL", "TITLE_PROPOSAL")).toBe(false);
    expect(isAllowedEvidenceSlot("TITLE", "TITLE_PROPOSAL")).toBe(true);
    expect(isAllowedEvidenceSlot("TITLE", "COR")).toBe(true);
    expect(isAllowedEvidenceSlot("TITLE", "RECEIPT")).toBe(true);
    expect(isAllowedEvidenceSlot("PROPOSAL", "COR")).toBe(true);
    expect(isAllowedEvidenceSlot("FINAL", "RECEIPT")).toBe(true);
  });

  it("lists required evidence types per stage", () => {
    expect(requiredEvidenceTypes("TITLE")).toEqual([
      "TITLE_PROPOSAL",
      "COR",
      "RECEIPT",
    ]);
    expect(requiredEvidenceTypes("PROPOSAL")).toEqual(["COR", "RECEIPT"]);
    expect(requiredEvidenceTypes("FINAL")).toEqual(["COR", "RECEIPT"]);
  });

  it("reports missing required current evidence", () => {
    expect(missingRequiredEvidence("TITLE", ["COR", "RECEIPT"])).toEqual([
      "TITLE_PROPOSAL",
    ]);
    expect(
      missingRequiredEvidence("TITLE", ["TITLE_PROPOSAL", "COR", "RECEIPT"]),
    ).toEqual([]);
    expect(missingRequiredEvidence("FINAL", ["COR"])).toEqual(["RECEIPT"]);
    expect(missingRequiredEvidence("PROPOSAL", [])).toEqual(["COR", "RECEIPT"]);
  });
});

describe("validateCurrentEvidenceCounts (exactly one per required slot)", () => {
  it("accepts exactly one current row per required Title slot", () => {
    expect(
      validateCurrentEvidenceCounts("TITLE", {
        TITLE_PROPOSAL: 1,
        COR: 1,
        RECEIPT: 1,
      }),
    ).toEqual([]);
  });

  it("flags a missing Title COR as MISSING", () => {
    const issues = validateCurrentEvidenceCounts("TITLE", {
      TITLE_PROPOSAL: 1,
      COR: 0,
      RECEIPT: 1,
    });
    expect(issues).toEqual([{ docType: "COR", kind: "MISSING", count: 0 }]);
  });

  it("flags more than one row as AMBIGUOUS", () => {
    const issues = validateCurrentEvidenceCounts("PROPOSAL", {
      COR: 2,
      RECEIPT: 1,
    });
    expect(issues).toEqual([{ docType: "COR", kind: "AMBIGUOUS", count: 2 }]);
  });

  it("ignores non-required document types", () => {
    const counts = { COR: 1, RECEIPT: 1, PROPOSAL_CHAPTERS: 3, FINAL_MANUSCRIPT: 2 };
    expect(validateCurrentEvidenceCounts("PROPOSAL", counts)).toEqual([]);
  });
});
