import { describe, expect, it } from "vitest";
import { hasStageDoc } from "../../../src/repositories/defense-eligibility.repository";

describe("hasStageDoc (stage-scoped evidence)", () => {
  const docs = [
    { docType: "RECEIPT", defenseStage: "TITLE" as string | null },
    { docType: "COR", defenseStage: "TITLE" as string | null },
    { docType: "RECEIPT", defenseStage: "PROPOSAL" as string | null },
    { docType: "PROPOSAL_CHAPTERS", defenseStage: null as string | null },
  ];

  it("Title receipt does not satisfy Proposal receipt", () => {
    expect(hasStageDoc(docs, "RECEIPT", "TITLE", "PROPOSAL")).toBe(true);
    expect(hasStageDoc(docs, "RECEIPT", "PROPOSAL", "PROPOSAL")).toBe(true);
    expect(
      hasStageDoc(
        [{ docType: "RECEIPT", defenseStage: "TITLE" }],
        "RECEIPT",
        "PROPOSAL",
        "PROPOSAL",
      ),
    ).toBe(false);
    expect(
      hasStageDoc(
        [{ docType: "RECEIPT", defenseStage: "TITLE" }],
        "RECEIPT",
        "FINAL",
        "FINAL",
      ),
    ).toBe(false);
  });

  it("legacy unscoped rows only count for the current thesis stage", () => {
    expect(hasStageDoc(docs, "PROPOSAL_CHAPTERS", "PROPOSAL", "PROPOSAL")).toBe(
      true,
    );
    expect(hasStageDoc(docs, "PROPOSAL_CHAPTERS", "TITLE", "PROPOSAL")).toBe(
      false,
    );
  });
});
