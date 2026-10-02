import { describe, expect, it } from "vitest";
import {
  STAGE_EVIDENCE_SLOTS,
  isAllowedEvidenceSlot,
  missingRequiredEvidence,
  requiredEvidenceTypes,
} from "../../../src/services/defense-evidence.rules";

describe("defense supporting-evidence stage/type matrix", () => {
  it("defines the exact confirmed slots per stage", () => {
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
    expect(missingRequiredEvidence("TITLE", ["TITLE_PROPOSAL", "COR", "RECEIPT"])).toEqual([]);
    expect(missingRequiredEvidence("FINAL", ["COR"])).toEqual(["RECEIPT"]);
    expect(missingRequiredEvidence("PROPOSAL", [])).toEqual(["COR", "RECEIPT"]);
  });
});
