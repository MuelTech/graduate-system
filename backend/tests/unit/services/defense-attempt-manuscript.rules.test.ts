import { describe, expect, it } from "vitest";

import { selectAuthoritativeAttemptManuscript } from "../../../src/services/defense-attempt-manuscript.rules";

const T = "thesis-1";

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    thesisId: T,
    docType: "TITLE_PROPOSAL",
    defenseStage: "TITLE",
    uploadedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as { id: string; thesisId?: string | null; docType: string; defenseStage: string | null; uploadedAt?: Date | null };
}

describe("selectAuthoritativeAttemptManuscript", () => {
  it("TITLE binds the newest uploaded TITLE_PROPOSAL package", () => {
    const docs = [
      doc({ id: "old", uploadedAt: new Date("2026-01-01T00:00:00Z") }),
      doc({ id: "new", uploadedAt: new Date("2026-05-01T00:00:00Z") }),
    ];
    expect(selectAuthoritativeAttemptManuscript(docs, [], "TITLE_DEFENSE", T)?.id).toBe("new");
  });

  it("TITLE accepts a legacy null defenseStage proposal", () => {
    const docs = [doc({ id: "legacy", defenseStage: null })];
    expect(selectAuthoritativeAttemptManuscript(docs, [], "TITLE_DEFENSE", T)?.id).toBe("legacy");
  });

  it("TITLE returns null when no proposal exists", () => {
    expect(selectAuthoritativeAttemptManuscript([], [], "TITLE_DEFENSE", T)).toBeNull();
  });

  it("PROPOSAL binds the exact ISSUED certification reviewedDocumentId", () => {
    const docs = [
      doc({ id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" }),
      doc({ id: "doc-B", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" }),
    ];
    const certs = [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }];
    expect(selectAuthoritativeAttemptManuscript(docs, certs, "PROPOSAL_DEFENSE", T)?.id).toBe("doc-A");
  });

  it("PROPOSAL returns null without a valid ISSUED certification", () => {
    const docs = [doc({ id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" })];
    expect(selectAuthoritativeAttemptManuscript(docs, [], "PROPOSAL_DEFENSE", T)).toBeNull();
    expect(
      selectAuthoritativeAttemptManuscript(
        docs,
        [{ status: "AWAITING_REVIEW", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }],
        "PROPOSAL_DEFENSE",
        T,
      ),
    ).toBeNull();
  });

  it("PROPOSAL rejects a cross-thesis or wrong-stage binding", () => {
    const crossThesis = [doc({ id: "doc-A", thesisId: "thesis-2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" })];
    const wrongType = [doc({ id: "doc-A", docType: "TITLE_PROPOSAL", defenseStage: "TITLE" })];
    const certs = [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }];
    expect(selectAuthoritativeAttemptManuscript(crossThesis, certs, "PROPOSAL_DEFENSE", T)).toBeNull();
    expect(selectAuthoritativeAttemptManuscript(wrongType, certs, "PROPOSAL_DEFENSE", T)).toBeNull();
  });

  it("FINAL binds the exact ISSUED certification reviewedDocumentId", () => {
    const docs = [doc({ id: "doc-F", docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" })];
    const certs = [{ status: "ISSUED", defenseStage: "FINAL_DEFENSE", reviewedDocumentId: "doc-F" }];
    expect(selectAuthoritativeAttemptManuscript(docs, certs, "FINAL_DEFENSE", T)?.id).toBe("doc-F");
  });

  it("FINAL returns null for an unsupported defense type or missing cert", () => {
    expect(selectAuthoritativeAttemptManuscript([], [], "UNKNOWN_DEFENSE", T)).toBeNull();
    expect(selectAuthoritativeAttemptManuscript([doc({ id: "x", docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" })], [], "FINAL_DEFENSE", T)).toBeNull();
  });

  it("is deterministic for PROPOSAL/FINAL regardless of doc array order", () => {
    const certs = [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }];
    const a = [doc({ id: "doc-B", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" }), doc({ id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" })];
    expect(selectAuthoritativeAttemptManuscript(a, certs, "PROPOSAL_DEFENSE", T)?.id).toBe("doc-A");
  });
});
