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
