import { describe, expect, it } from "vitest";
import {
  canPanelistAccessThesisDocument,
} from "../../../src/services/document.service";
import {
  isAuthoritativePriorProposalManuscript,
} from "../../../src/services/proposal-adviser-review.rules";

function makeRecord(opts: {
  id?: string;
  thesisId?: string;
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
  const thesisId = opts.thesisId ?? "thesis-1";
  return {
    id: opts.id ?? "doc-1",
    thesisId,
    defenseStage: opts.defenseStage ?? null,
    docType: opts.docType ?? null,
    thesis: {
      id: thesisId,
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
  const finalOnlySchedules = [
    {
      defenseType: "FINAL_DEFENSE",
      panelAssignments: [{ userId: "final-panelist" }],
    },
  ];

  it("Test 6: Final participant may access exact certified prior Proposal manuscript", () => {
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: finalOnlySchedules,
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(true);
  });

  it("Test 7: Final participant denied un-certified Proposal revision B", () => {
    const record = makeRecord({
      id: "doc-proposal-b",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: finalOnlySchedules,
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("CP8-FIX1: correct id but wrong docType → denied", () => {
    // Cert points at id, but document is COR not PROPOSAL_CHAPTERS.
    // effectiveStage resolves to PROPOSAL via docType? COR + stage PROPOSAL → stage wins.
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "PROPOSAL",
      docType: "COR",
      certs: certifiedProposalCert,
      schedules: finalOnlySchedules,
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);
  });

  it("CP8-FIX1: correct id/type but wrong defenseStage → denied", () => {
    // docType implies PROPOSAL path, but explicit stage is not PROPOSAL —
    // full certified validation requires defenseStage === "PROPOSAL".
    const record = makeRecord({
      id: "doc-proposal-a",
      defenseStage: "TITLE",
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: finalOnlySchedules,
    });
    expect(canPanelistAccessThesisDocument(record, "final-panelist")).toBe(false);

    // Null stage: inferred PROPOSAL path, but isValidCertifiedProposalManuscript
    // requires explicit defenseStage PROPOSAL → fail closed.
    const nullStage = makeRecord({
      id: "doc-proposal-a",
      defenseStage: null,
      docType: "PROPOSAL_CHAPTERS",
      certs: certifiedProposalCert,
      schedules: finalOnlySchedules,
    });
    expect(canPanelistAccessThesisDocument(nullStage, "final-panelist")).toBe(false);
  });

  it("CP8-FIX1: document thesisId mismatched from cert thesis → denied", () => {
    const record = {
      id: "doc-proposal-a",
      thesisId: "thesis-other",
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      thesis: {
        id: "thesis-1",
        student: { adviserAssignments: [] },
        adviserCertifications: certifiedProposalCert,
        defenseSchedules: finalOnlySchedules,
      },
    };
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

  it("isAuthoritativePriorProposalManuscript enforces full certified identity", () => {
    const validDoc = {
      id: "doc-proposal-a",
      thesisId: "thesis-1",
      docType: "PROPOSAL_CHAPTERS",
      defenseStage: "PROPOSAL",
    };
    const cert = {
      status: "ISSUED",
      defenseStage: "PROPOSAL_DEFENSE",
      reviewedDocumentId: "doc-proposal-a",
    };
    expect(isAuthoritativePriorProposalManuscript(validDoc, cert, "thesis-1")).toBe(true);

    // id mismatch
    expect(
      isAuthoritativePriorProposalManuscript(
        { ...validDoc, id: "doc-proposal-b" },
        cert,
        "thesis-1",
      ),
    ).toBe(false);

    // wrong docType
    expect(
      isAuthoritativePriorProposalManuscript(
        { ...validDoc, docType: "COR" },
        cert,
        "thesis-1",
      ),
    ).toBe(false);

    // wrong defenseStage
    expect(
      isAuthoritativePriorProposalManuscript(
        { ...validDoc, defenseStage: "FINAL" },
        cert,
        "thesis-1",
      ),
    ).toBe(false);

    // thesisId mismatch (doc vs cert thesis)
    expect(
      isAuthoritativePriorProposalManuscript(validDoc, cert, "thesis-other"),
    ).toBe(false);

    // non-ISSUED cert
    expect(
      isAuthoritativePriorProposalManuscript(
        validDoc,
        { ...cert, status: "PENDING" },
        "thesis-1",
      ),
    ).toBe(false);
  });
});
