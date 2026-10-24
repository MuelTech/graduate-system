import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  defenseSchedule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  panelAssignment: { createMany: vi.fn(), findMany: vi.fn() },
  thesisRecord: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
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
      thesisId: d.thesisId ?? "thesis-1",
      docType: d.docType,
      defenseStage: d.defenseStage ?? null,
      isCurrent: d.isCurrent ?? true,
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
    tx.panelAssignment.findMany.mockResolvedValue([
      {
        id: "pa-1",
        userId: "u1",
        role: "CHAIRMAN",
        user: { firstName: "One", lastName: "Chair" },
      },
    ]);
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
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

  function expectNoPartialPersistence() {
    expect(tx.defenseSchedule.create).not.toHaveBeenCalled();
    expect(tx.panelAssignment.createMany).not.toHaveBeenCalled();
    expect(tx.thesisRecord.update).not.toHaveBeenCalled();
  }

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

  it("TITLE binds the CURRENT package over a newer superseded upload", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([
        { id: "title-current", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", isCurrent: true, uploadedAt: new Date("2026-01-01T00:00:00Z") },
        { id: "title-superseded", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", isCurrent: false, uploadedAt: new Date("2026-06-01T00:00:00Z") },
      ]),
    );
    await repo.scheduleDefense(...baseArgs);
    expect(createdData.manuscriptDocumentId).toBe("title-current");
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

  it("rejects scheduling (no partial persistence) when no Title package can be proven", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(thesisWithDocs([]));
    await expect(repo.scheduleDefense(...baseArgs)).rejects.toMatchObject({ statusCode: 409 });
    expectNoPartialPersistence();
  });

  it("rejects scheduling when only a superseded Title package exists", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([
        { id: "title-superseded", docType: "TITLE_PROPOSAL", defenseStage: "TITLE", isCurrent: false },
      ]),
    );
    await expect(repo.scheduleDefense(...baseArgs)).rejects.toMatchObject({ statusCode: 409 });
    expectNoPartialPersistence();
  });

  it("rejects scheduling when the Proposal certification is missing", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([{ id: "doc-A", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" }]),
    );
    await expect(
      repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "PROPOSAL_DEFENSE" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expectNoPartialPersistence();
  });

  it("rejects scheduling when the Final certification is missing", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([{ id: "doc-F", docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" }]),
    );
    await expect(
      repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "FINAL_DEFENSE" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expectNoPartialPersistence();
  });

  it("rejects scheduling for a cross-thesis / wrong-stage certification target", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs(
        [{ id: "doc-x", docType: "TITLE_PROPOSAL", defenseStage: "TITLE" }],
        [{ status: "ISSUED", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-x" }],
      ),
    );
    await expect(
      repo.scheduleDefense("thesis-1", "admin-1", { ...baseArgs[2], defenseType: "PROPOSAL_DEFENSE" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expectNoPartialPersistence();
  });

  it("creates the initial active roster and writes the canonical schedule-created audit in the same transaction", async () => {
    tx.thesisRecord.findUnique.mockResolvedValue(
      thesisWithDocs([
        { id: "title-1", docType: "TITLE_PROPOSAL", defenseStage: "TITLE" },
      ]),
    );

    await repo.scheduleDefense(...baseArgs);

    expect(tx.panelAssignment.createMany).toHaveBeenCalledWith({
      data: [
        {
          scheduleId: "sched-1",
          userId: "u1",
          role: "CHAIRMAN",
          isActive: true,
        },
      ],
    });
    expect(tx.panelAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scheduleId: "sched-1", isActive: true },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const data = tx.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      actorId: "admin-1",
      actionType: "DEFENSE_SCHEDULE_CREATED",
      targetTable: "defense_schedules",
      targetId: "sched-1",
      oldValue: null,
    });
    expect(JSON.parse(data.newValue)).toMatchObject({
      scheduleId: "sched-1",
      thesisId: "thesis-1",
      defenseType: "TITLE_DEFENSE",
      schedule: {
        defenseDate: "2026-10-20T00:00:00.000Z",
        defenseTime: "1970-01-01T09:00:00.000Z",
        venueOrLink: "Room 201",
      },
      committee: [
        {
          assignmentId: "pa-1",
          userId: "u1",
          role: "CHAIRMAN",
        },
      ],
    });
  });
});
