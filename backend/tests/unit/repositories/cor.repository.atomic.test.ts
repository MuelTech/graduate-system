import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    corUpload: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { CorRepository } from "../../../src/repositories/cor.repository";

const uploadData = {
  studentId: "student-1",
  filePath: "/root/cor/abc.pdf",
  originalFilename: "cor.pdf",
  detectedMimeType: "application/pdf",
  status: "PENDING" as const,
  uploadedAt: new Date(),
};

const audit = {
  actorId: "user-1",
  actionType: "COR_UPLOAD",
  description: "COR uploaded",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.__tx.corUpload.findFirst.mockResolvedValue(null);
  prismaMock.__tx.corUpload.create.mockResolvedValue({ id: "cor-1" });
  prismaMock.__tx.auditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("CorRepository atomic upload + audit boundary", () => {
  it("locks the student row, writes the upload and audit inside one transaction", async () => {
    const repo = new CorRepository();
    const result = await repo.createUploadWithAudit(uploadData as never, audit);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledTimes(1);
    // The authoritative Student-row lock must precede the existence checks.
    expect(
      prismaMock.__tx.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(prismaMock.__tx.corUpload.findFirst.mock.invocationCallOrder[0]);
    expect(prismaMock.__tx.corUpload.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.__tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetTable: "cor_uploads",
        targetId: "cor-1",
        actionType: "COR_UPLOAD",
      }),
    });
    expect(result).toEqual({ id: "cor-1" });
  });

  it("propagates a failure in the audit boundary so the transaction rolls back", async () => {
    prismaMock.__tx.auditLog.create.mockRejectedValue(new Error("audit down"));

    const repo = new CorRepository();
    await expect(
      repo.createUploadWithAudit(uploadData as never, audit),
    ).rejects.toThrow("audit down");
  });

  it("fails closed when an active PENDING upload already exists (concurrent upload guard)", async () => {
    // First findFirst = PENDING check → an existing active row.
    prismaMock.__tx.corUpload.findFirst.mockResolvedValueOnce({ id: "cor-existing" });

    const repo = new CorRepository();
    await expect(
      repo.createUploadWithAudit(uploadData as never, audit),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.corUpload.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed when a VERIFIED upload already exists", async () => {
    prismaMock.__tx.corUpload.findFirst
      .mockResolvedValueOnce(null) // no PENDING
      .mockResolvedValueOnce({ id: "cor-verified" }); // VERIFIED present

    const repo = new CorRepository();
    await expect(
      repo.createUploadWithAudit(uploadData as never, audit),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.__tx.corUpload.create).not.toHaveBeenCalled();
  });
});
