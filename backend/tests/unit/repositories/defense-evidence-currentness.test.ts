import { describe, expect, it } from "vitest";
import { hasStageDoc } from "../../../src/repositories/defense-eligibility.repository";

describe("DL-6 currentness in stage evidence", () => {
  it("does not count a superseded (isCurrent=false) supporting document", () => {
    const docs = [
      { docType: "COR", defenseStage: "TITLE", isCurrent: false },
    ];
    expect(hasStageDoc(docs, "COR", "TITLE", "TITLE")).toBe(false);
  });

  it("counts a current supporting document", () => {
    const docs = [
      { docType: "COR", defenseStage: "TITLE", isCurrent: true },
    ];
    expect(hasStageDoc(docs, "COR", "TITLE", "TITLE")).toBe(true);
  });

  it("treats legacy rows without explicit currentness as current", () => {
    const docs = [{ docType: "RECEIPT", defenseStage: "FINAL" }];
    expect(hasStageDoc(docs, "RECEIPT", "FINAL", "FINAL")).toBe(true);
  });

  it("still enforces stage isolation regardless of currentness", () => {
    const docs = [
      { docType: "COR", defenseStage: "TITLE", isCurrent: true },
    ];
    expect(hasStageDoc(docs, "COR", "PROPOSAL", "PROPOSAL")).toBe(false);
  });
});
