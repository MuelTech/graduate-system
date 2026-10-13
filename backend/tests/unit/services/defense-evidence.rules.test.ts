import { describe, expect, it } from "vitest";
import {
  STAGE_EVIDENCE_SLOTS,
  isAllowedEvidenceSlot,
  missingRequiredEvidence,
  requiredEvidenceTypes,
  validateCurrentEvidenceCounts,
} from "../../../src/services/defense-evidence.rules";

/**
 * UIUX-4B: under the confirmed Title Defense digital scope, a NEW Title
 * application requires three proposed titles + ONE Title Defense Proposal
 * Package. COR and defense-fee proof are NOT Title-stage requirements.
 * Proposal/Final keep COR + RECEIPT.
 */
describe("defense supporting-evidence stage/type matrix", () => {
  it("defines the exact confirmed slots per stage", () => {
    expect(STAGE_EVIDENCE_SLOTS.TITLE).toEqual(["TITLE_PROPOSAL"]);
    expect(STAGE_EVIDENCE_SLOTS.PROPOSAL).toEqual(["COR", "RECEIPT"]);
    expect(STAGE_EVIDENCE_SLOTS.FINAL).toEqual(["COR", "RECEIPT"]);
  });

  it("rejects wrong-stage evidence fields", () => {
    expect(isAllowedEvidenceSlot("PROPOSAL", "TITLE_PROPOSAL")).toBe(false);
    expect(isAllowedEvidenceSlot("FINAL", "TITLE_PROPOSAL")).toBe(false);
    expect(isAllowedEvidenceSlot("TITLE", "TITLE_PROPOSAL")).toBe(true);
    // Title no longer accepts COR/RECEIPT as stage evidence.
    expect(isAllowedEvidenceSlot("TITLE", "COR")).toBe(false);
    expect(isAllowedEvidenceSlot("TITLE", "RECEIPT")).toBe(false);
    expect(isAllowedEvidenceSlot("PROPOSAL", "COR")).toBe(true);
    expect(isAllowedEvidenceSlot("FINAL", "RECEIPT")).toBe(true);
  });

  it("lists required evidence types per stage", () => {
    expect(requiredEvidenceTypes("TITLE")).toEqual(["TITLE_PROPOSAL"]);
    expect(requiredEvidenceTypes("PROPOSAL")).toEqual(["COR", "RECEIPT"]);
    expect(requiredEvidenceTypes("FINAL")).toEqual(["COR", "RECEIPT"]);
  });

  it("reports missing required current evidence", () => {
    expect(missingRequiredEvidence("TITLE", [])).toEqual(["TITLE_PROPOSAL"]);
    expect(missingRequiredEvidence("TITLE", ["TITLE_PROPOSAL"])).toEqual([]);
    // Legacy Title COR/RECEIPT rows are ignored (not requirements).
    expect(
      missingRequiredEvidence("TITLE", ["COR", "RECEIPT"]),
    ).toEqual(["TITLE_PROPOSAL"]);
    expect(missingRequiredEvidence("FINAL", ["COR"])).toEqual(["RECEIPT"]);
    expect(missingRequiredEvidence("PROPOSAL", [])).toEqual(["COR", "RECEIPT"]);
  });
});

describe("validateCurrentEvidenceCounts (exactly one per required slot)", () => {
  it("accepts a Title application with only the proposal package", () => {
    expect(
      validateCurrentEvidenceCounts("TITLE", { TITLE_PROPOSAL: 1 }),
    ).toEqual([]);
  });

  it("flags zero rows as MISSING", () => {
    const issues = validateCurrentEvidenceCounts("TITLE", { TITLE_PROPOSAL: 0 });
    expect(issues).toEqual([
      { docType: "TITLE_PROPOSAL", kind: "MISSING", count: 0 },
    ]);
    // Proposal still requires COR + RECEIPT.
    expect(
      validateCurrentEvidenceCounts("PROPOSAL", { COR: 0, RECEIPT: 1 }),
    ).toEqual([{ docType: "COR", kind: "MISSING", count: 0 }]);
  });

  it("flags more than one row as AMBIGUOUS", () => {
    const issues = validateCurrentEvidenceCounts("PROPOSAL", {
      COR: 2,
      RECEIPT: 1,
    });
    expect(issues).toEqual([{ docType: "COR", kind: "AMBIGUOUS", count: 2 }]);
  });

  it("ignores non-required document types", () => {
    const counts = {
      TITLE_PROPOSAL: 1,
      COR: 1,
      RECEIPT: 1,
      PROPOSAL_CHAPTERS: 3,
      FINAL_MANUSCRIPT: 2,
    };
    // Title ignores legacy COR/RECEIPT rows entirely.
    expect(validateCurrentEvidenceCounts("TITLE", counts)).toEqual([]);
    expect(validateCurrentEvidenceCounts("PROPOSAL", counts)).toEqual([]);
  });
});
