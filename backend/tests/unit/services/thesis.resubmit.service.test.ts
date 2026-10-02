import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getStudentByUserId: vi.fn(),
  getThesisById: vi.fn(),
  resubmitWithEvidence: vi.fn(),
  getCurrentEvidence: vi.fn(),
  getProposedTitles: vi.fn(),
  getActiveThesis: vi.fn(),
  getEvidenceHistory: vi.fn(),
  findNonCancelledSchedules: vi.fn(),
  rejectApplication: vi.fn(),
  approveApplication: vi.fn(),
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
    findNonCancelledSchedules = repo.findNonCancelledSchedules;
    rejectApplication = repo.rejectApplication;
    approveApplication = repo.approveApplication;
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

describe("ThesisService rejection canonical guard", () => {
  it("refuses REJECTED via the generic status endpoint (must use the audited reject action)", async () => {
    const svc = new ThesisService();
    await expect(
      svc.updateDefenseStatus("thesis-1", { status: "REJECTED" }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("ThesisService application decision guards", () => {
  it("PENDING -> APPROVED delegates to the atomic claim", async () => {
    repo.getThesisById.mockResolvedValue({
      id: "thesis-1",
      studentId: "s",
      status: "PENDING",
      stage: "PROPOSAL",
    });
    repo.findNonCancelledSchedules.mockResolvedValue([]);
    repo.approveApplication.mockResolvedValue({
      id: "thesis-1",
      status: "APPROVED",
      rejectionReason: null,
      stage: "PROPOSAL",
    });
    const svc = new ThesisService();
    await svc.updateDefenseStatus("thesis-1", { status: "APPROVED" }, "admin-1");
    expect(repo.approveApplication).toHaveBeenCalledWith({
      thesisId: "thesis-1",
      actorId: "admin-1",
      stage: "PROPOSAL",
    });
  });

  it("REJECTED -> APPROVED is rejected before persistence", async () => {
    repo.getThesisById.mockResolvedValue({
      id: "thesis-1",
      studentId: "s",
      status: "REJECTED",
      stage: "PROPOSAL",
    });
    repo.findNonCancelledSchedules.mockResolvedValue([]);
    const svc = new ThesisService();
    await expect(
      svc.updateDefenseStatus("thesis-1", { status: "APPROVED" }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.approveApplication).not.toHaveBeenCalled();
  });

  it("PENDING -> REJECTED delegates to the atomic claim", async () => {
    repo.getThesisById.mockResolvedValue({
      id: "thesis-1",
      studentId: "s",
      status: "PENDING",
      stage: "TITLE",
    });
    repo.rejectApplication.mockResolvedValue({
      id: "thesis-1",
      status: "REJECTED",
      rejectionReason: "x",
      stage: "TITLE",
    });
    const svc = new ThesisService();
    await svc.rejectApplication("thesis-1", "x", "admin-1");
    expect(repo.rejectApplication).toHaveBeenCalledWith({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "x",
      stage: "TITLE",
    });
  });

  it("APPROVED / SCHEDULED / PASSED cannot be rejected", async () => {
    const svc = new ThesisService();
    for (const status of ["APPROVED", "SCHEDULED", "PASSED"]) {
      repo.getThesisById.mockResolvedValue({
        id: "thesis-1",
        studentId: "s",
        status,
        stage: "TITLE",
      });
      await expect(
        svc.rejectApplication("thesis-1", "x", "admin-1"),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
    expect(repo.rejectApplication).not.toHaveBeenCalled();
  });

  it("rejection still requires a reason", async () => {
    repo.getThesisById.mockResolvedValue({
      id: "thesis-1",
      studentId: "s",
      status: "PENDING",
      stage: "TITLE",
    });
    const svc = new ThesisService();
    await expect(
      svc.rejectApplication("thesis-1", "   ", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.rejectApplication).not.toHaveBeenCalled();
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
