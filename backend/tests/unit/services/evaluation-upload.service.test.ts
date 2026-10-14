import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    expertEvaluationRequest: { create: vi.fn() },
    thesisDocument: { create: vi.fn() },
  };
  return {
    student: { findUnique: vi.fn() },
    thesisRecord: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { EvaluationService } from "../../../src/services/evaluation.service";

const upload = {
  filePath: "/root/instruments/abc",
  storageKey: "instruments/abc",
  storageProvider: "local",
  originalFilename: "instrument.pdf",
  verifiedMimeType: "application/pdf",
  sizeBytes: 1234,
  checksum: "deadbeef",
  checksumAlgorithm: "sha256",
  uploadedById: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.__tx.expertEvaluationRequest.create.mockResolvedValue({ id: "req-1" });
  prismaMock.__tx.thesisDocument.create.mockResolvedValue({});
});

describe("EvaluationService secure instrument upload", () => {
  it("rejects when the student has no active thesis", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    const service = new EvaluationService();
    await expect(
      service.submitEvaluationRequest("user-1", { instrumentType: "Survey" }, upload),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("persists verified storage metadata on the managed document", async () => {
    prismaMock.student.findUnique.mockResolvedValue({ id: "student-1" });
    prismaMock.thesisRecord.findFirst.mockResolvedValue({ id: "thesis-1", studentId: "student-1" });

    const service = new EvaluationService();
    await service.submitEvaluationRequest("user-1", { instrumentType: "Survey" }, upload);

    expect(prismaMock.__tx.thesisDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        thesisId: "thesis-1",
        docType: "INSTRUMENTS",
        filePath: "/root/instruments/abc",
        storageKey: "instruments/abc",
        storageProvider: "local",
        originalFilename: "instrument.pdf",
        verifiedMimeType: "application/pdf",
        sizeBytes: 1234,
        checksum: "deadbeef",
        checksumAlgorithm: "sha256",
        uploadedById: "user-1",
      }),
    });
  });
});
