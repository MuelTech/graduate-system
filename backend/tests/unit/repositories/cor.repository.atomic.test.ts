import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    corUpload: { create: vi.fn() },
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
});

describe("CorRepository atomic upload + audit boundary", () => {
  it("writes the upload row and its audit record inside one transaction", async () => {
    prismaMock.__tx.corUpload.create.mockResolvedValue({ id: "cor-1" });
    prismaMock.__tx.auditLog.create.mockResolvedValue({ id: "log-1" });

    const repo = new CorRepository();
    const result = await repo.createUploadWithAudit(uploadData as never, audit);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
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
    prismaMock.__tx.corUpload.create.mockResolvedValue({ id: "cor-1" });
    prismaMock.__tx.auditLog.create.mockRejectedValue(new Error("audit down"));

    const repo = new CorRepository();
    await expect(
      repo.createUploadWithAudit(uploadData as never, audit),
    ).rejects.toThrow("audit down");
  });
});
