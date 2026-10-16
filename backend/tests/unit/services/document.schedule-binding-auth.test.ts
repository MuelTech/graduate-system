import { describe, expect, it } from "vitest";

import { canPanelistAccessThesisDocument } from "../../../src/services/document.service";

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-A",
    thesisId: "thesis-1",
    docType: "PROPOSAL_CHAPTERS",
    defenseStage: "PROPOSAL",
    thesis: {
      id: "thesis-1",
      student: { adviserAssignments: [] },
      adviserCertifications: [],
      defenseSchedules: [],
    },
    ...overrides,
  } as never;
}

describe("canPanelistAccessThesisDocument — CDW-2 schedule binding", () => {
  it("allows an assigned member of the schedule that bound the document", () => {
    const rec = record({
      thesis: {
        id: "thesis-1",
        student: { adviserAssignments: [] },
        adviserCertifications: [],
        defenseSchedules: [
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-A", panelAssignments: [{ userId: "u-in" }] },
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-OTHER", panelAssignments: [{ userId: "u-other" }] },
        ],
      },
    });
    expect(canPanelistAccessThesisDocument(rec, "u-in")).toBe(true);
  });

  it("denies an unrelated same-stage member once the document is bound", () => {
    const rec = record({
      thesis: {
        id: "thesis-1",
        student: { adviserAssignments: [] },
        adviserCertifications: [],
        defenseSchedules: [
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-A", panelAssignments: [{ userId: "u-in" }] },
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-OTHER", panelAssignments: [{ userId: "u-other" }] },
        ],
      },
    });
    expect(canPanelistAccessThesisDocument(rec, "u-other")).toBe(false);
    expect(canPanelistAccessThesisDocument(rec, "u-none")).toBe(false);
  });

  it("keeps the legacy stage grant for an UNBOUND document", () => {
    const rec = record({
      id: "doc-X",
      thesis: {
        id: "thesis-1",
        student: { adviserAssignments: [] },
        adviserCertifications: [],
        defenseSchedules: [
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-OTHER", panelAssignments: [{ userId: "u-stage" }] },
        ],
      },
    });
    expect(canPanelistAccessThesisDocument(rec, "u-stage")).toBe(true);
  });

  it("still allows the active adviser", () => {
    const rec = record({
      thesis: {
        id: "thesis-1",
        student: { adviserAssignments: [{ adviserId: "u-adv" }] },
        adviserCertifications: [],
        defenseSchedules: [
          { defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-A", panelAssignments: [{ userId: "u-in" }] },
        ],
      },
    });
    expect(canPanelistAccessThesisDocument(rec, "u-adv")).toBe(true);
  });
});

describe("canPanelistAccessThesisDocument — Final → exact passed Proposal attempt", () => {
  const passedProposal = {
    defenseType: "PROPOSAL_DEFENSE",
    manuscriptDocumentId: "doc-A",
    conclusion: { outcome: "PASSED" },
    panelAssignments: [{ userId: "u-prop" }],
  };
  const finalSchedule = {
    defenseType: "FINAL_DEFENSE",
    manuscriptDocumentId: "doc-F",
    conclusion: null,
    panelAssignments: [{ userId: "u-final" }],
  };
  const thesisWith = (
    schedules: Array<Record<string, unknown>>,
  ) => ({
    id: "thesis-1",
    student: { adviserAssignments: [] },
    adviserCertifications: [],
    defenseSchedules: schedules,
  });

  it("allows a DIFFERENT Final committee to fetch the exact manuscript bound to the PASSED Proposal attempt", () => {
    const rec = record({
      id: "doc-A",
      thesis: thesisWith([passedProposal, finalSchedule]),
    });
    expect(canPanelistAccessThesisDocument(rec, "u-final")).toBe(true);
    // The binding Proposal committee keeps its own access.
    expect(canPanelistAccessThesisDocument(rec, "u-prop")).toBe(true);
  });

  it("denies an arbitrary Proposal revision that is not the bound passed attempt", () => {
    const rec = record({
      id: "doc-B",
      thesis: thesisWith([passedProposal, finalSchedule]),
    });
    expect(canPanelistAccessThesisDocument(rec, "u-final")).toBe(false);
  });

  it("denies a manuscript bound to a REDEFENSE_REQUIRED Proposal attempt", () => {
    const rec = record({
      id: "doc-X",
      thesis: thesisWith([
        {
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-X",
          conclusion: { outcome: "REDEFENSE_REQUIRED" },
          panelAssignments: [{ userId: "u-prop" }],
        },
        finalSchedule,
      ]),
    });
    expect(canPanelistAccessThesisDocument(rec, "u-final")).toBe(false);
  });

  it("denies a manuscript bound to a FAILED Proposal attempt", () => {
    const rec = record({
      id: "doc-X",
      thesis: thesisWith([
        {
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-X",
          conclusion: { outcome: "FAILED" },
          panelAssignments: [{ userId: "u-prop" }],
        },
        finalSchedule,
      ]),
    });
    expect(canPanelistAccessThesisDocument(rec, "u-final")).toBe(false);
  });

  it("denies an unrelated panelist the passed Proposal bound manuscript", () => {
    const rec = record({
      id: "doc-A",
      thesis: thesisWith([passedProposal, finalSchedule]),
    });
    expect(canPanelistAccessThesisDocument(rec, "u-unrelated")).toBe(false);
  });

  it("keeps each attempt isolated: only the owning attempt committee reaches its bound doc", () => {
    const recA = record({
      id: "doc-A",
      docType: "FINAL_MANUSCRIPT",
      defenseStage: "FINAL",
      thesis: thesisWith([
        { defenseType: "FINAL_DEFENSE", manuscriptDocumentId: "doc-A", conclusion: null, panelAssignments: [{ userId: "u-1" }] },
        { defenseType: "FINAL_DEFENSE", manuscriptDocumentId: "doc-B", conclusion: null, panelAssignments: [{ userId: "u-2" }] },
      ]),
    });
    expect(canPanelistAccessThesisDocument(recA, "u-1")).toBe(true);
    expect(canPanelistAccessThesisDocument(recA, "u-2")).toBe(false);

    const recB = record({
      id: "doc-B",
      docType: "FINAL_MANUSCRIPT",
      defenseStage: "FINAL",
      thesis: thesisWith([
        { defenseType: "FINAL_DEFENSE", manuscriptDocumentId: "doc-A", conclusion: null, panelAssignments: [{ userId: "u-1" }] },
        { defenseType: "FINAL_DEFENSE", manuscriptDocumentId: "doc-B", conclusion: null, panelAssignments: [{ userId: "u-2" }] },
      ]),
    });
    expect(canPanelistAccessThesisDocument(recB, "u-2")).toBe(true);
    expect(canPanelistAccessThesisDocument(recB, "u-1")).toBe(false);
  });
});
