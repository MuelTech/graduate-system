import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-10-23T06:35:00.000Z");

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    thesisRecord: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    thesisTitle: { create: vi.fn() },
    thesisDocument: {
      createMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    defenseSchedule: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    panelAssignment: { createMany: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";
import type { ManagedUploadInput } from "../../../src/storage/managed-upload";

function upload(suffix: string): ManagedUploadInput {
  return {
    filePath: `/private/evidence/${suffix}`,
    storageKey: `evidence/${suffix}`,
    storageProvider: "local",
    originalFilename: `${suffix}.pdf`,
    verifiedMimeType: "application/pdf",
    sizeBytes: 111,
    checksum: `sum-${suffix}`,
    checksumAlgorithm: "sha256",
    uploadedById: "user-1",
  };
}

function tx() {
  return prismaMock.__tx;
}

const TIMESTAMP_KEYS = [
  "titleApplicationSubmittedAt",
  "proposalApplicationSubmittedAt",
  "finalApplicationSubmittedAt",
];

function expectOnlyStageTimestamp(
  data: Record<string, unknown>,
  stage: "TITLE" | "PROPOSAL" | "FINAL",
) {
  const expectedKey =
    stage === "TITLE"
      ? "titleApplicationSubmittedAt"
      : stage === "PROPOSAL"
        ? "proposalApplicationSubmittedAt"
        : "finalApplicationSubmittedAt";
  expect(data[expectedKey]).toEqual(NOW);
  for (const key of TIMESTAMP_KEYS) {
    if (key !== expectedKey) expect(data).not.toHaveProperty(key);
  }
}

function arrangeResubmitEvidence(stage: "TITLE" | "PROPOSAL" | "FINAL") {
  const slots =
    stage === "TITLE"
      ? ["TITLE_PROPOSAL", "COR", "RECEIPT"]
      : ["COR", "RECEIPT"];
  tx().thesisDocument.findMany.mockImplementation(async (args: any) => {
    if (typeof args?.where?.docType === "string") return [];
    return slots.map((docType) => ({ docType }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  tx().$queryRaw.mockResolvedValue([]);
  tx().thesisRecord.create.mockResolvedValue({ id: "thesis-1" });
  tx().thesisRecord.update.mockResolvedValue({ id: "thesis-1" });
  tx().thesisRecord.updateMany.mockResolvedValue({ count: 1 });
  tx().thesisRecord.findFirst.mockResolvedValue(null);
  tx().thesisRecord.findUnique.mockResolvedValue(null);
  tx().thesisTitle.create.mockResolvedValue({ id: "title-1" });
  tx().thesisDocument.createMany.mockResolvedValue({ count: 3 });
  tx().thesisDocument.create.mockResolvedValue({ id: "doc-new" });
  tx().thesisDocument.findMany.mockResolvedValue([]);
  tx().thesisDocument.updateMany.mockResolvedValue({ count: 1 });
  tx().defenseSchedule.findMany.mockResolvedValue([]);
  tx().defenseSchedule.create.mockResolvedValue({ id: "sched-1" });
  tx().defenseSchedule.findUnique.mockResolvedValue({ id: "sched-1" });
  tx().panelAssignment.findMany.mockResolvedValue([]);
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ThesisRepository stage application submission timestamps", () => {
  it("sets only the Title timestamp on a new Title application", async () => {
    const repo = new ThesisRepository();
    await repo.createTitleDefense("student-1", null, [], {
      conceptPaper: upload("pkg"),
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    const data = tx().thesisRecord.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      studentId: "student-1",
      stage: "TITLE",
      status: "PENDING",
    });
    expectOnlyStageTimestamp(data, "TITLE");
  });

  it("sets only the Proposal timestamp and preserves Title on a new Proposal application", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "TITLE" });
    const repo = new ThesisRepository();
    await repo.updateThesisToProposal("thesis-1", {
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    const data = tx().thesisRecord.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ stage: "PROPOSAL", status: "PENDING", outcome: null });
    expectOnlyStageTimestamp(data, "PROPOSAL");
  });

  it("sets only the Final timestamp and preserves earlier stages on a new Final application", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "PROPOSAL" });
    const repo = new ThesisRepository();
    await repo.updateThesisToFinal("thesis-1", {
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    const data = tx().thesisRecord.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ stage: "FINAL", status: "PENDING", outcome: null });
    expectOnlyStageTimestamp(data, "FINAL");
  });

  it.each(["TITLE", "PROPOSAL", "FINAL"] as const)(
    "a successful %s resubmission updates only that stage timestamp",
    async (stage) => {
      tx().thesisRecord.findUnique.mockResolvedValue({
        studentId: "student-1",
        status: "REJECTED",
        stage,
      });
      arrangeResubmitEvidence(stage);
      const repo = new ThesisRepository();

      await repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage,
        replacements:
          stage === "TITLE"
            ? [
                { docType: "TITLE_PROPOSAL", upload: upload("pkg") },
                { docType: "COR", upload: upload("cor") },
                { docType: "RECEIPT", upload: upload("rcpt") },
              ]
            : [
                { docType: "COR", upload: upload("cor") },
                { docType: "RECEIPT", upload: upload("rcpt") },
              ],
        audit: { actorId: "user-1", description: "resubmit" },
      });

      const data = tx().thesisRecord.updateMany.mock.calls[0][0].data;
      expect(data).toMatchObject({ status: "PENDING", rejectionReason: null });
      expectOnlyStageTimestamp(data, stage);
    },
  );

  it("does not advance any timestamp when resubmission evidence validation fails", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({
      studentId: "student-1",
      status: "REJECTED",
      stage: "PROPOSAL",
    });
    // Final validation sees only COR, so the required RECEIPT is missing.
    tx().thesisDocument.findMany.mockImplementation(async (args: any) => {
      if (typeof args?.where?.docType === "string") return [];
      return [{ docType: "COR" }];
    });
    const repo = new ThesisRepository();

    await expect(
      repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage: "PROPOSAL",
        replacements: [{ docType: "COR", upload: upload("cor") }],
        audit: { actorId: "user-1", description: "resubmit" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(tx().thesisRecord.updateMany).not.toHaveBeenCalled();
  });

  it("Admin rejection and approval do not change submission timestamps", async () => {
    const repo = new ThesisRepository();

    await repo.rejectApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "Missing evidence",
      stage: "PROPOSAL",
    });
    expect(tx().thesisRecord.updateMany.mock.calls[0][0].data).toEqual({
      status: "REJECTED",
      rejectionReason: "Missing evidence",
    });

    await repo.approveApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      stage: "PROPOSAL",
    });
    expect(tx().thesisRecord.updateMany.mock.calls[1][0].data).toEqual({
      status: "APPROVED",
      rejectionReason: null,
    });
  });

  it("scheduling does not change submission timestamps", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({
      thesisDocuments: [
        {
          id: "doc-1",
          thesisId: "thesis-1",
          docType: "TITLE_PROPOSAL",
          defenseStage: "TITLE",
          isCurrent: true,
          uploadedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
      adviserCertifications: [],
    });
    const repo = new ThesisRepository();

    await repo.scheduleDefense("thesis-1", "admin-1", {
      defenseDate: "2026-11-01",
      defenseTime: "10:00",
      venueOrLink: "Room 101",
      defenseType: "TITLE_DEFENSE",
      assignments: [{ userId: "u1", role: "CHAIRMAN" }],
    });

    expect(tx().thesisRecord.update).toHaveBeenCalledWith({
      where: { id: "thesis-1" },
      data: { status: "SCHEDULED" },
    });
  });
});
