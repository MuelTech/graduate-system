import { describe, expect, it } from "vitest";
import { canPanelistAccessThesisDocument } from "../../../src/services/document.service";

function makeRecord(opts: {
  defenseStage?: string | null;
  adviserIds?: string[];
  schedules?: Array<{
    defenseType: string;
    panelAssignments: Array<{ userId: string }>;
  }>;
}) {
  return {
    defenseStage: opts.defenseStage ?? null,
    thesis: {
      student: {
        adviserAssignments: (opts.adviserIds ?? []).map((adviserId) => ({
          adviserId,
        })),
      },
      defenseSchedules: opts.schedules ?? [],
    },
  };
}

describe("CP3-FIX1 stage-aware thesis document auth", () => {
  it("Test L: active Adviser allowed Proposal pre-review document", () => {
    const record = makeRecord({
      defenseStage: "PROPOSAL",
      adviserIds: ["adviser-1"],
    });
    expect(canPanelistAccessThesisDocument(record, "adviser-1")).toBe(true);
  });

  it("Test K: historical Title Panelist denied Proposal document", () => {
    const record = makeRecord({
      defenseStage: "PROPOSAL",
      schedules: [
        {
          defenseType: "TITLE_DEFENSE",
          panelAssignments: [{ userId: "title-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "title-panelist")).toBe(false);
  });

  it("Test M: Proposal scheduled Panelist can access Proposal document", () => {
    const record = makeRecord({
      defenseStage: "PROPOSAL",
      schedules: [
        {
          defenseType: "PROPOSAL_DEFENSE",
          panelAssignments: [{ userId: "proposal-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "proposal-panelist")).toBe(true);
  });

  it("Test N: stage isolation Title vs Proposal vs Final", () => {
    const titleOnly = makeRecord({
      defenseStage: "PROPOSAL",
      schedules: [
        {
          defenseType: "TITLE_DEFENSE",
          panelAssignments: [{ userId: "p1" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(titleOnly, "p1")).toBe(false);

    const proposalOnlyFinalDoc = makeRecord({
      defenseStage: "FINAL",
      schedules: [
        {
          defenseType: "PROPOSAL_DEFENSE",
          panelAssignments: [{ userId: "p2" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(proposalOnlyFinalDoc, "p2")).toBe(false);

    const unscoped = makeRecord({
      defenseStage: null,
      schedules: [
        {
          defenseType: "TITLE_DEFENSE",
          panelAssignments: [{ userId: "p3" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(unscoped, "p3")).toBe(true);
  });

  it("unrelated Panelist denied", () => {
    const record = makeRecord({
      defenseStage: "PROPOSAL",
      schedules: [
        {
          defenseType: "PROPOSAL_DEFENSE",
          panelAssignments: [{ userId: "someone-else" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "unrelated")).toBe(false);
  });
});
