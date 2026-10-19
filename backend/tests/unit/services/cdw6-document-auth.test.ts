import { describe, expect, it } from "vitest";

import { canPanelistAccessThesisDocument } from "../../../src/services/document.service";

interface Schedule {
  id?: string;
  defenseType: string;
  manuscriptDocumentId?: string | null;
  defenseDate?: string | Date | null;
  createdAt?: string | Date | null;
  conclusion?: { outcome?: string } | null;
  panelAssignments: Array<{ userId: string }>;
}

function makeRecord(opts: {
  id: string;
  thesisId?: string;
  defenseStage?: string | null;
  docType?: string | null;
  certs?: Array<{ defenseStage: string; status: string; reviewedDocumentId?: string | null }>;
  schedules?: Schedule[];
}) {
  const thesisId = opts.thesisId ?? "thesis-1";
  return {
    id: opts.id,
    thesisId,
    defenseStage: opts.defenseStage ?? null,
    docType: opts.docType ?? null,
    isCurrent: true,
    thesis: {
      id: thesisId,
      student: { adviserAssignments: [] },
      adviserCertifications: opts.certs ?? [],
      defenseSchedules: opts.schedules ?? [],
    },
  };
}

describe("CDW-6 historical bound-manuscript document authorization", () => {
  it("a replacement current Panelist may read the exact bound prior manuscript", () => {
    const record = makeRecord({
      id: "doc-prop-1",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "REDEFENSE_REQUIRED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        {
          id: "prop-2",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-2",
          defenseDate: "2026-09-15",
          conclusion: null,
          panelAssignments: [{ userId: "new-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "new-panelist")).toBe(true);
  });

  it("a Final committee may read the PASSED prior Proposal binding (no current cert needed)", () => {
    const record = makeRecord({
      id: "doc-prop-1",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      // Deliberately no ISSUED cert: the attempt binding is the authority.
      certs: [],
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        {
          id: "final-1",
          defenseType: "FINAL_DEFENSE",
          defenseDate: "2026-10-01",
          conclusion: null,
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(true);
  });

  it("an unrelated Panelist is denied", () => {
    const record = makeRecord({
      id: "doc-prop-1",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        {
          id: "final-1",
          defenseType: "FINAL_DEFENSE",
          defenseDate: "2026-10-01",
          conclusion: null,
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "stranger")).toBe(false);
  });

  it("a future/unrelated schedule on the same thesis does not grant broad document access", () => {
    const record = makeRecord({
      id: "doc-prop-1",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-09-15",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        // Current attempt is EARLIER (a Title attempt) → not history.
        {
          id: "title-0",
          defenseType: "TITLE_DEFENSE",
          defenseDate: "2026-05-01",
          conclusion: null,
          panelAssignments: [{ userId: "title-only" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "title-only")).toBe(false);
  });

  it("an arbitrary ThesisDocument that is not the exact attempt binding is denied", () => {
    const record = makeRecord({
      id: "doc-unbound",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        {
          id: "final-1",
          defenseType: "FINAL_DEFENSE",
          defenseDate: "2026-10-01",
          conclusion: null,
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("supporting evidence cannot become visible through historical manuscript authority", () => {
    const record = makeRecord({
      id: "doc-cor",
      defenseStage: "PROPOSAL",
      docType: "COR",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-cor",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
        {
          id: "final-1",
          defenseType: "FINAL_DEFENSE",
          defenseDate: "2026-10-01",
          conclusion: null,
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("preserves a historical attempt's own committee access to its exact binding", () => {
    const record = makeRecord({
      id: "doc-prop-1",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      schedules: [
        {
          id: "prop-1",
          defenseType: "PROPOSAL_DEFENSE",
          manuscriptDocumentId: "doc-prop-1",
          defenseDate: "2026-07-01",
          conclusion: { outcome: "PASSED" },
          panelAssignments: [{ userId: "old-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "old-panelist")).toBe(true);
  });
});
