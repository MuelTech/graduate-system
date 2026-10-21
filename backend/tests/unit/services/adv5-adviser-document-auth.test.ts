import { describe, expect, it } from "vitest";
import {
  canActiveAdviserAccessAcademicThesisDocument,
  resolveAdviserAcademicDocument,
} from "../../../src/services/adviser-document.rules";
import { canPanelistAccessThesisDocument } from "../../../src/services/document.service";

function record(opts: {
  docType?: string | null;
  defenseStage?: string | null;
  adviserIds?: string[];
  isCurrent?: boolean;
}) {
  const thesisId = "thesis-1";
  return {
    id: "doc-1",
    thesisId,
    docType: opts.docType ?? null,
    defenseStage: opts.defenseStage ?? null,
    isCurrent: opts.isCurrent ?? true,
    thesis: {
      id: thesisId,
      student: {
        adviserAssignments: (opts.adviserIds ?? []).map((adviserId) => ({
          adviserId,
        })),
      },
      adviserCertifications: [],
      defenseSchedules: [],
    },
  };
}

describe("ADV-5 active-Adviser academic document allow-list", () => {
  it("allows valid Title/Proposal/Final academic documents", () => {
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "TITLE_PROPOSAL",
          defenseStage: "TITLE",
          adviserIds: ["adviser-1"],
        }),
        "adviser-1",
      ),
    ).toBe(true);
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          adviserIds: ["adviser-1"],
        }),
        "adviser-1",
      ),
    ).toBe(true);
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "FINAL_MANUSCRIPT",
          defenseStage: "FINAL",
          adviserIds: ["adviser-1"],
        }),
        "adviser-1",
      ),
    ).toBe(true);
  });

  it("allows a valid superseded academic version for the current advisee", () => {
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          adviserIds: ["adviser-1"],
          isCurrent: false,
        }),
        "adviser-1",
      ),
    ).toBe(true);
  });

  it("allows legacy null-stage rows only when docType safely implies the stage", () => {
    for (const [docType, stage] of [
      ["TITLE_PROPOSAL", "TITLE"],
      ["PROPOSAL_CHAPTERS", "PROPOSAL"],
      ["FINAL_MANUSCRIPT", "FINAL"],
    ] as const) {
      expect(
        canPanelistAccessThesisDocument(
          record({
            docType,
            defenseStage: null,
            adviserIds: ["adviser-1"],
          }),
          "adviser-1",
        ),
      ).toBe(true);
      expect(resolveAdviserAcademicDocument({ docType, defenseStage: null }))
        .toMatchObject({ stage });
    }
  });

  it("denies non-academic evidence even with an explicit stage", () => {
    for (const [docType, stage] of [
      ["COR", "PROPOSAL"],
      ["RECEIPT", "FINAL"],
      ["INSTRUMENTS", "FINAL"],
      ["RESPONDENT_DATA", "FINAL"],
      ["PLAGIARISM_REPORT", "FINAL"],
    ] as const) {
      expect(
        canPanelistAccessThesisDocument(
          record({ docType, defenseStage: stage, adviserIds: ["adviser-1"] }),
          "adviser-1",
        ),
      ).toBe(false);
      expect(resolveAdviserAcademicDocument({ docType, defenseStage: stage }))
        .toBeNull();
    }
  });

  it("denies contradictory academic type/stage identities", () => {
    for (const [docType, stage] of [
      ["PROPOSAL_CHAPTERS", "FINAL"],
      ["FINAL_MANUSCRIPT", "PROPOSAL"],
      ["TITLE_PROPOSAL", "PROPOSAL"],
    ] as const) {
      expect(
        canPanelistAccessThesisDocument(
          record({ docType, defenseStage: stage, adviserIds: ["adviser-1"] }),
          "adviser-1",
        ),
      ).toBe(false);
      expect(resolveAdviserAcademicDocument({ docType, defenseStage: stage }))
        .toBeNull();
    }
  });

  it("denies a different Adviser", () => {
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          adviserIds: ["adviser-2"],
        }),
        "adviser-1",
      ),
    ).toBe(false);
  });

  it("denies a former/inactive Adviser because no active row is loaded", () => {
    expect(
      canPanelistAccessThesisDocument(
        record({
          docType: "FINAL_MANUSCRIPT",
          defenseStage: "FINAL",
          adviserIds: [],
        }),
        "former-adviser",
      ),
    ).toBe(false);
  });

  it("fails closed for duplicate active Adviser rows", () => {
    expect(
      canActiveAdviserAccessAcademicThesisDocument({
        userId: "adviser-1",
        activeAdviserIds: ["adviser-1", "adviser-2"],
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
      }),
    ).toBe(false);
  });
});
