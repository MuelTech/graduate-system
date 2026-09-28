import { describe, expect, it } from "vitest";
import {
  canPanelistAccessThesisDocument,
} from "../../../src/services/document.service";
import {
  isAuthoritativePriorProposalManuscript,
} from "../../../src/services/proposal-adviser-review.rules";

function makeRecord(opts: {
  id?: string;
  defenseStage?: string | null;
  docType?: string | null;
  adviserIds?: string[];
  certs?: Array<{
    defenseStage: string;
    status: string;
    reviewedDocumentId?: string | null;
  }>;
  schedules?: Array<{
    defenseType: string;
    panelAssignments: Array<{ userId: string }>;
  }>;
}) {
  return {
    id: opts.id ?? "doc-1",
    defenseStage: opts.defenseStage ?? null,
    docType: opts.docType ?? null,
    thesis: {
      student: {
        adviserAssignments: (opts.adviserIds ?? []).map((adviserId) => ({
          adviserId,
        })),
      },
      adviserCertifications: opts.certs ?? [],
      defenseSchedules: opts.schedules ?? [],
    },
  };
}

describe("CP8 Final→prior-Proposal document authorization", () => {
  const certifiedProposalCert = [
    {
      defenseStage: "PROPOSAL_DEFENSE",
      status: "ISSUED",
      reviewedDocumentId: "doc-proposal-a",
    },
  ];

  it("Test 6: Final participant may access exact certified prior Proposal manuscript", () => {
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: [
        {
          defenseType: "FINAL_DEFENSE",
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(true);
  });

  it("Test 7: Final participant denied un-certified Proposal revision B", () => {
    const record = makeRecord({
      id: "doc-proposal-b",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: [
        {
          defenseType: "FINAL_DEFENSE",
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("Test 8: Proposal-only assignment does not grant Final manuscript access", () => {
    const record = makeRecord({
      id: "doc-final-c",
      defenseStage: "FINAL",
      docType: "FINAL_MANUSCRIPT",
      certs: certifiedProposalCert,
      schedules: [
        {
          defenseType: "PROPOSAL_DEFENSE",
          panelAssignments: [{ userId: "proposal-only" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "proposal-only")).toBe(false);
  });

  it("Test 9: Title-only assignment does not grant Proposal/Final manuscript access", () => {
    const proposal = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: [
        {
          defenseType: "TITLE_DEFENSE",
          panelAssignments: [{ userId: "title-only" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(proposal, "title-only")).toBe(false);

    const final = makeRecord({
      id: "doc-final-c",
      defenseStage: "FINAL",
      docType: "FINAL_MANUSCRIPT",
      schedules: [
        {
          defenseType: "TITLE_DEFENSE",
          panelAssignments: [{ userId: "title-only" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(final, "title-only")).toBe(false);
  });

  it("Test 10: unassigned Panelist remains denied", () => {
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: [
        {
          defenseType: "FINAL_DEFENSE",
          panelAssignments: [{ userId: "someone-else" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "unrelated")).toBe(false);
  });

  it("CP8 exception does not open Proposal docs without matching cert binding", () => {
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: [
        {
          defenseStage: "PROPOSAL_DEFENSE",
          status: "AWAITING_REVIEW",
          reviewedDocumentId: "doc-proposal-a",
        },
      ],
      schedules: [
        {
          defenseType: "FINAL_DEFENSE",
          panelAssignments: [{ userId: "final-panelist" }],
        },
      ],
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("active Adviser access is preserved", () => {
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      adviserIds: ["adviser-1"],
      certs: certifiedProposalCert,
      schedules: [],
    });
    expect(canPanelistAccessThesisDocument(record, "adviser-1")).toBe(true);
  });

  it("isAuthoritativePriorProposalManuscript matches ISSUED binding only", () => {
    expect(
      isAuthoritativePriorProposalManuscript("doc-proposal-a", {
        status: "ISSUED",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewedDocumentId: "doc-proposal-a",
      }),
    ).toBe(true);
    expect(
      isAuthoritativePriorProposalManuscript("doc-proposal-b", {
        status: "ISSUED",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewedDocumentId: "doc-proposal-a",
      }),
    ).toBe(false);
    expect(
      isAuthoritativePriorProposalManuscript("doc-proposal-a", {
        status: "PENDING",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewedDocumentId: "doc-proposal-a",
      }),
    ).toBe(false);
  });
});
