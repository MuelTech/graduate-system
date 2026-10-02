import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getStudentByUserId: vi.fn(),
  getThesisById: vi.fn(),
  resubmitWithEvidence: vi.fn(),
  getCurrentEvidence: vi.fn(),
  getProposedTitles: vi.fn(),
  getActiveThesis: vi.fn(),
  getEvidenceHistory: vi.fn(),
}));

vi.mock("../../../src/repositories/thesis.repository", () => ({
  ThesisRepository: class {
    getStudentByUserId = repo.getStudentByUserId;
    getThesisById = repo.getThesisById;
    resubmitWithEvidence = repo.resubmitWithEvidence;
    getCurrentEvidence = repo.getCurrentEvidence;
    getProposedTitles = repo.getProposedTitles;
    getActiveThesis = repo.getActiveThesis;
    getEvidenceHistory = repo.getEvidenceHistory;
  },
}));

vi.mock("../../../src/repositories/defense-eligibility.repository", () => ({
  DefenseEligibilityRepository: class {
    loadForStudent = vi.fn();
  },
}));

import { ThesisService } from "../../../src/services/thesis.service";
import type { ManagedUploadInput } from "../../../src/storage/managed-upload";

function upload(suffix: string): ManagedUploadInput {
  return {
    filePath: `/private/${suffix}`,
    storageKey: `evidence/${suffix}`,
    storageProvider: "local",
    originalFilename: `${suffix}.pdf`,
    verifiedMimeType: "application/pdf",
    sizeBytes: 1,
    checksum: "c",
    checksumAlgorithm: "sha256",
    uploadedById: "user-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.getStudentByUserId.mockResolvedValue({ id: "student-1" });
});

describe("ThesisService.resubmitApplication guards", () => {
  it("rejects a non-owner", async () => {
    repo.getThesisById.mockResolvedValue({ id: "thesis-1", studentId: "other", status: "REJECTED", stage: "TITLE" });
    const svc = new ThesisService();
    await expect(
      svc.resubmitApplication("user-1", "thesis-1", {}),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.resubmitWithEvidence).not.toHaveBeenCalled();
  });

  it("rejects a non-REJECTED application", async () => {
    repo.getThesisById.mockResolvedValue({ id: "thesis-1", studentId: "student-1", status: "PENDING", stage: "TITLE" });
    const svc = new ThesisService();
    await expect(
      svc.resubmitApplication("user-1", "thesis-1", {}),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.resubmitWithEvidence).not.toHaveBeenCalled();
  });

  it("rejects wrong-stage evidence fields (Proposal + conceptPaper)", async () => {
    repo.getThesisById.mockResolvedValue({ id: "thesis-1", studentId: "student-1", status: "REJECTED", stage: "PROPOSAL" });
    const svc = new ThesisService();
    await expect(
      svc.resubmitApplication("user-1", "thesis-1", { conceptPaper: upload("pkg") }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.resubmitWithEvidence).not.toHaveBeenCalled();
  });

  it("rejects wrong-stage evidence fields (Final + title package)", async () => {
    repo.getThesisById.mockResolvedValue({ id: "thesis-1", studentId: "student-1", status: "REJECTED", stage: "FINAL" });
    const svc = new ThesisService();
    await expect(
      svc.resubmitApplication("user-1", "thesis-1", { conceptPaper: upload("pkg") }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("ThesisService.getMyCurrentApplication privacy", () => {
  it("returns stage evidence without raw filePath or storageKey", async () => {
    repo.getActiveThesis.mockResolvedValue({
      id: "thesis-1",
      stage: "TITLE",
      status: "REJECTED",
      rejectionReason: "COR unclear",
    });
    repo.getEvidenceHistory.mockResolvedValue([
      {
        id: "doc-1",
        docType: "COR",
        defenseStage: "TITLE",
        filePath: "D:\\private\\root\\cor.pdf",
        storageKey: "evidence/cor",
        originalFilename: "cor.pdf",
        verifiedMimeType: "application/pdf",
        sizeBytes: 10,
        uploadedAt: new Date("2026-01-01"),
        isCurrent: true,
        supersedesDocumentId: null,
      },
    ]);

    const svc = new ThesisService();
    const result = await svc.getMyCurrentApplication("user-1");
    const serialized = JSON.stringify(result);

    expect(result?.thesisId).toBe("thesis-1");
    expect(result?.rejectionReason).toBe("COR unclear");
    expect(result?.evidence[0]).toMatchObject({ id: "doc-1", docType: "COR", isCurrent: true });
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("private");
  });
});
