import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  defenseSchedule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  panelAssignment: { createMany: vi.fn() },
  thesisRecord: { findUnique: vi.fn(), update: vi.fn() },
};

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";

function thesisWithDocs(docs: Array<Record<string, unknown>>, certs: Array<Record<string, unknown>> = []) {
  return {
    thesisDocuments: docs.map((d) => ({
      id: d.id,
      thesisId: "thesis-1",
      docType: d.docType,
      defenseStage: d.defenseStage ?? null,
      uploadedAt: d.uploadedAt ?? new Date("2026-01-01T00:00:00Z"),
    })),
    adviserCertifications: certs,
  };
}

describe("ThesisRepository.scheduleDefense — exact attempt manuscript binding", () => {
  const repo = new ThesisRepository();
  let createdData: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.defenseSchedule.findMany.mockResolvedValue([]);
    tx.defenseSchedule.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      createdData = args.data;
      return { id: "sched-1", ...args.data };
    });
    tx.defenseSchedule.update.mockResolvedValue({});
    tx.defenseSchedule.findUnique.mockResolvedValue({ id: "sched-1", panelAssignments: [] });
    tx.panelAssignment.createMany.mockResolvedValue({ count: 1 });
    tx.thesisRecord.update.mockResolvedValue({});
    tx.thesisRecord.findUnique.mockResolvedValue(thesisWithDocs([]));
  });

  const baseArgs: [string, string, {
    defenseDate: string; defenseTime: string; venueOrLink: string; defenseType: string; assignments: Array<{ userId: string; role: string }>;
  }] = [
    "thesis-1",
    "admin-1",
    { defenseDate: "2026-10-20", defenseTime: "09:00", venueOrLink: "Room 201", defenseType: "TITLE_DEFENSE", assignments: [{ userId: "u1", role: "CHAIRMAN" }] },
  ];

  it("TITLE binds the authoritative Title Proposal package", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([
        { id: "title-old", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", uploadedAt: new Date("2026-01-01T00:00:00Z") },
        { id: "title-new", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", uploadedAt: new Date("2026-06-01T00:00:00Z") },
      ]),
    );
    await repo.scheduleDefense(...baseArgs);
    expect(createdData.manuscriptDocumentId).toBe("title-new");
  });

  it("PROPOSAL binds the ISSUED certification reviewedDocumentId", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs(
        [
          { id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" },
          { id: "doc-B", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true },
        ],
        [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }],
      ),
    );
    await repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "PROPOSAL_DEFENSE" });
    expect(createdData.manuscriptDocumentId).toBe("doc-A");
  });

  it("FINAL binds the ISSUED certification reviewedDocumentId", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs(
        [{ id: "doc-F", docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" }],
        [{ status: "ISSUED", defenseStage: "FINAL_DEFENSE", reviewedDocumentId: "doc-F" }],
      ),
    );
    await repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "FINAL_DEFENSE" });
    expect(createdData.manuscriptDocumentId).toBe("doc-F");
  });

  it("binds null (fail closed) when no authoritative manuscript can be proven", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(thesisWithDocs([]));
    await repo.scheduleDefense(...baseArgs);
    expect(createdData.manuscriptDocumentId).toBeNull();
  });

  it("refuses to bind a cross-thesis / wrong-stage document", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs(
        [{ id: "doc-x", docType: "TITLE_PROPOSAL", defenseStage: "TITLE" }],
        [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-x" }],
      ),
    );
    await repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "PROPOSAL_DEFENSE" });
    expect(createdData.manuscriptDocumentId).toBeNull();
  });
});
