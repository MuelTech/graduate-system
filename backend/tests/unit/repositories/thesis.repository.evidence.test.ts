import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.clearAllMocks();
  tx().$queryRaw.mockResolvedValue([]);
  tx().thesisRecord.create.mockResolvedValue({ id: "thesis-1" });
  tx().thesisRecord.update.mockResolvedValue({ id: "thesis-1" });
  tx().thesisRecord.updateMany.mockResolvedValue({ count: 1 });
  tx().thesisRecord.findFirst.mockResolvedValue(null);
  tx().thesisTitle.create.mockResolvedValue({ id: "title-1" });
  tx().thesisDocument.createMany.mockResolvedValue({ count: 3 });
  tx().thesisDocument.create.mockResolvedValue({ id: "doc-new" });
  tx().thesisDocument.findMany.mockResolvedValue([]);
  tx().thesisDocument.updateMany.mockResolvedValue({ count: 1 });
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("ThesisRepository initial supporting-evidence persistence", () => {
  it("persists full managed metadata and currentness for Title evidence", async () => {
    const repo = new ThesisRepository();
    await repo.createTitleDefense("student-1", "assign-1", ["A", "B", "C"], {
      conceptPaper: upload("pkg"),
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    expect(tx().thesisRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId: "student-1", stage: "TITLE", status: "PENDING" }),
    });
    expect(tx().thesisTitle.create).toHaveBeenCalledTimes(3);

    const data = tx().thesisDocument.createMany.mock.calls[0][0].data;
    expect(data.map((d: { docType: string }) => d.docType)).toEqual([
      "TITLE_PROPOSAL",
      "COR",
      "RECEIPT",
    ]);
    for (const row of data) {
      expect(row).toEqual(
        expect.objectContaining({
          defenseStage: "TITLE",
          storageProvider: "local",
          verifiedMimeType: "application/pdf",
          sizeBytes: 111,
          checksumAlgorithm: "sha256",
          uploadedById: "user-1",
          isCurrent: true,
        }),
      );
    }
  });

  it("does not create a PROPOSAL_CHAPTERS manuscript during Proposal application", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "TITLE" });
    const repo = new ThesisRepository();
    await repo.updateThesisToProposal("thesis-1", {
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    const data = tx().thesisDocument.createMany.mock.calls[0][0].data;
    expect(data.map((d: { docType: string }) => d.docType)).toEqual(["COR", "RECEIPT"]);
    expect(data.every((d: { defenseStage: string }) => d.defenseStage === "PROPOSAL")).toBe(true);
  });

  it("does not create a FINAL_MANUSCRIPT manuscript during Final application", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "PROPOSAL" });
    const repo = new ThesisRepository();
    await repo.updateThesisToFinal("thesis-1", {
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });

    const data = tx().thesisDocument.createMany.mock.calls[0][0].data;
    expect(data.map((d: { docType: string }) => d.docType)).toEqual(["COR", "RECEIPT"]);
  });
});

describe("ThesisRepository Title initial-application concurrency", () => {
  it("locks the Student, then fails closed when a blocking thesis already exists", async () => {
    tx().thesisRecord.findFirst.mockResolvedValue({ id: "existing", status: "PENDING" });
    const repo = new ThesisRepository();

    await expect(
      repo.createTitleDefense("student-1", null, ["A", "B", "C"], {
        conceptPaper: upload("pkg"),
        cor: upload("cor"),
        receipt: upload("rcpt"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx().$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx().thesisRecord.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx().thesisRecord.create).not.toHaveBeenCalled();
    expect(tx().thesisDocument.createMany).not.toHaveBeenCalled();
  });

  it("allows creation when the only existing thesis is FAILED", async () => {
    tx().thesisRecord.findFirst.mockResolvedValue({ id: "old", status: "FAILED" });
    const repo = new ThesisRepository();
    await repo.createTitleDefense("student-1", null, ["A", "B", "C"], {
      conceptPaper: upload("pkg"),
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });
    expect(tx().thesisRecord.create).toHaveBeenCalledTimes(1);
  });
});

describe("ThesisRepository Proposal/Final initial-application concurrency", () => {
  it("refuses Proposal when the thesis has already advanced", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "PROPOSAL" });
    const repo = new ThesisRepository();
    await expect(
      repo.updateThesisToProposal("thesis-1", { cor: upload("cor"), receipt: upload("rcpt") }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisDocument.createMany).not.toHaveBeenCalled();
  });

  it("refuses Proposal when current Proposal evidence already exists", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "TITLE" });
    tx().thesisDocument.findMany.mockResolvedValue([{ id: "cor-existing" }]);
    const repo = new ThesisRepository();
    await expect(
      repo.updateThesisToProposal("thesis-1", { cor: upload("cor"), receipt: upload("rcpt") }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisDocument.createMany).not.toHaveBeenCalled();
  });

  it("refuses Final when the thesis has not reached Proposal", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "TITLE" });
    const repo = new ThesisRepository();
    await expect(
      repo.updateThesisToFinal("thesis-1", { cor: upload("cor"), receipt: upload("rcpt") }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisDocument.createMany).not.toHaveBeenCalled();
  });

  it("locks the thesis before the stage check and evidence creation", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({ stage: "TITLE" });
    const repo = new ThesisRepository();
    await repo.updateThesisToProposal("thesis-1", {
      cor: upload("cor"),
      receipt: upload("rcpt"),
    });
    expect(tx().$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx().thesisDocument.createMany.mock.invocationCallOrder[0],
    );
  });
});

describe("ThesisRepository.resubmitWithEvidence", () => {
  beforeEach(() => {
    tx().thesisRecord.findUnique.mockResolvedValue({
      studentId: "student-1",
      status: "REJECTED",
      stage: "TITLE",
    });
  });

  it("locks, supersedes the current slot, inserts the replacement, and audits atomically", async () => {
    tx().thesisDocument.findMany
      .mockResolvedValueOnce([{ id: "cor-v1" }])
      .mockResolvedValueOnce([
        { docType: "TITLE_PROPOSAL" },
        { docType: "COR" },
        { docType: "RECEIPT" },
      ]);
    tx().thesisDocument.create.mockResolvedValue({ id: "cor-v2" });

    const repo = new ThesisRepository();
    const result = await repo.resubmitWithEvidence({
      thesisId: "thesis-1",
      studentId: "student-1",
      stage: "TITLE",
      replacements: [{ docType: "COR", upload: upload("cor-v2") }],
      audit: { actorId: "user-1", description: "resubmit" },
    });

    expect(tx().thesisDocument.updateMany).toHaveBeenCalledWith({
      where: { id: "cor-v1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(tx().thesisDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          docType: "COR",
          defenseStage: "TITLE",
          isCurrent: true,
          supersedesDocumentId: "cor-v1",
        }),
      }),
    );
    expect(tx().thesisRecord.updateMany).toHaveBeenCalledWith({
      where: { id: "thesis-1", studentId: "student-1", status: "REJECTED", stage: "TITLE" },
      data: { status: "PENDING", rejectionReason: null },
    });
    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ createdIds: ["cor-v2"], supersededIds: ["cor-v1"] });
  });

  it("fails closed when the application is not the exact REJECTED stage record", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({
      studentId: "student-1",
      status: "PENDING",
      stage: "TITLE",
    });
    const repo = new ThesisRepository();
    await expect(
      repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage: "TITLE",
        replacements: [],
        audit: { actorId: "user-1", description: "resubmit" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisDocument.create).not.toHaveBeenCalled();
  });

  it("fails closed on ambiguous multiple current rows for a replaced slot", async () => {
    tx().thesisDocument.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    const repo = new ThesisRepository();
    await expect(
      repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage: "TITLE",
        replacements: [{ docType: "COR", upload: upload("cor-v2") }],
        audit: { actorId: "user-1", description: "resubmit" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisDocument.create).not.toHaveBeenCalled();
  });

  it("fails closed with MISSING when a required slot has zero current rows", async () => {
    tx().thesisDocument.findMany.mockResolvedValueOnce([{ docType: "COR" }]);
    const repo = new ThesisRepository();
    await expect(
      repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage: "TITLE",
        replacements: [],
        audit: { actorId: "user-1", description: "resubmit" },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("fails closed with AMBIGUOUS when a required slot has two current rows (zero-file)", async () => {
    tx().thesisDocument.findMany.mockResolvedValueOnce([
      { docType: "TITLE_PROPOSAL" },
      { docType: "COR" },
      { docType: "COR" },
      { docType: "RECEIPT" },
    ]);
    const repo = new ThesisRepository();
    await expect(
      repo.resubmitWithEvidence({
        thesisId: "thesis-1",
        studentId: "student-1",
        stage: "TITLE",
        replacements: [],
        audit: { actorId: "user-1", description: "resubmit" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().thesisRecord.updateMany).not.toHaveBeenCalled();
  });

  it("allows a zero-file resubmit when every required slot has exactly one current row", async () => {
    tx().thesisDocument.findMany.mockResolvedValueOnce([
      { docType: "TITLE_PROPOSAL" },
      { docType: "COR" },
      { docType: "RECEIPT" },
    ]);
    const repo = new ThesisRepository();
    const result = await repo.resubmitWithEvidence({
      thesisId: "thesis-1",
      studentId: "student-1",
      stage: "TITLE",
      replacements: [],
      audit: { actorId: "user-1", description: "resubmit" },
    });
    expect(result).toEqual({ createdIds: [], supersededIds: [] });
    expect(tx().thesisDocument.create).not.toHaveBeenCalled();
  });

  it("ignores ambiguity in a non-required document type (manuscript)", async () => {
    tx().thesisRecord.findUnique.mockResolvedValue({
      studentId: "student-1",
      status: "REJECTED",
      stage: "PROPOSAL",
    });
    tx().thesisDocument.findMany.mockResolvedValueOnce([
      { docType: "COR" },
      { docType: "RECEIPT" },
      { docType: "PROPOSAL_CHAPTERS" },
      { docType: "PROPOSAL_CHAPTERS" },
    ]);
    const repo = new ThesisRepository();
    const result = await repo.resubmitWithEvidence({
      thesisId: "thesis-1",
      studentId: "student-1",
      stage: "PROPOSAL",
      replacements: [],
      audit: { actorId: "user-1", description: "resubmit" },
    });
    expect(result).toEqual({ createdIds: [], supersededIds: [] });
  });

  it("DL-8: audit retains prior rejection reason + replacement chain, no storage internals", async () => {
    tx().thesisDocument.findMany
      .mockResolvedValueOnce([{ id: "cor-v1" }])
      .mockResolvedValueOnce([
        { docType: "TITLE_PROPOSAL" },
        { docType: "COR" },
        { docType: "RECEIPT" },
      ]);
    tx().thesisDocument.create.mockResolvedValue({ id: "cor-v2" });
    const repo = new ThesisRepository();
    await repo.resubmitWithEvidence({
      thesisId: "thesis-1",
      studentId: "student-1",
      stage: "TITLE",
      replacements: [{ docType: "COR", upload: upload("cor-v2") }],
      audit: { actorId: "user-1", description: "resubmit" },
      previousRejectionReason: "Upload a clearer COR",
    });

    const auditArg = tx().auditLog.create.mock.calls[0][0];
    expect(auditArg.data.actionType).toBe("DEFENSE_RESUBMIT");
    const payload = JSON.parse(auditArg.data.newValue);
    expect(payload.stage).toBe("TITLE");
    expect(payload.previousRejectionReason).toBe("Upload a clearer COR");
    expect(payload.replacements).toEqual([
      { docType: "COR", supersededDocumentId: "cor-v1", createdDocumentId: "cor-v2" },
    ]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("checksum");
  });
});
