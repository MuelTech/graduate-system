import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findStudentByUserId: vi.fn(),
  checkPassedExam: vi.fn(),
  getActiveUploadByStudentId: vi.fn(),
  getVerifiedUploadByStudentId: vi.fn(),
  getUploadByStudentIdLatest: vi.fn(),
  getCurrentUploadByStudentId: vi.fn(),
  getUploadById: vi.fn(),
  createUploadWithAudit: vi.fn(),
  verifyAndPromote: vi.fn(),
  rejectUpload: vi.fn(),
  checkVerifiedRecord: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("../../../src/repositories/cor.repository", () => ({
  CorRepository: class {
    findStudentByUserId = repo.findStudentByUserId;
    checkPassedExam = repo.checkPassedExam;
    getActiveUploadByStudentId = repo.getActiveUploadByStudentId;
    getVerifiedUploadByStudentId = repo.getVerifiedUploadByStudentId;
    getUploadByStudentIdLatest = repo.getUploadByStudentIdLatest;
    getCurrentUploadByStudentId = repo.getCurrentUploadByStudentId;
    getUploadById = repo.getUploadById;
    createUploadWithAudit = repo.createUploadWithAudit;
    verifyAndPromote = repo.verifyAndPromote;
    rejectUpload = repo.rejectUpload;
    checkVerifiedRecord = repo.checkVerifiedRecord;
    createAuditLog = repo.createAuditLog;
  },
}));

vi.mock("file-type", () => ({
  fileTypeFromFile: vi.fn(async () => ({ mime: "application/pdf" })),
}));
vi.mock("fs/promises", () => ({
  default: { unlink: vi.fn(async () => undefined) },
  unlink: vi.fn(async () => undefined),
}));
vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: vi.fn(async () => undefined) },
}));
vi.mock("../../../src/extraction/cor-extraction.service", () => ({
  CorExtractionService: class {
    processUpload = vi.fn(async () => ({ status: "PENDING" }));
  },
}));

import { CorService } from "../../../src/services/cor.service";

const storageMeta = {
  storageKey: "cor/abc",
  storageProvider: "local",
  originalFilename: "cor.pdf",
  verifiedMimeType: "application/pdf",
  sizeBytes: 1234,
  checksum: "deadbeef",
  checksumAlgorithm: "sha256",
};

function managedFile() {
  return {
    path: "/root/cor/abc",
    originalname: "cor.pdf",
    storageMeta,
  } as unknown as Express.Multer.File;
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.findStudentByUserId.mockResolvedValue({ id: "student-1", userId: "user-1" });
  repo.checkPassedExam.mockResolvedValue({ id: "exam-1", status: "PASSED" });
  repo.getActiveUploadByStudentId.mockResolvedValue(null);
  repo.getVerifiedUploadByStudentId.mockResolvedValue(null);
  repo.createUploadWithAudit.mockResolvedValue({ id: "cor-1", status: "PENDING" });
});

describe("CorService.uploadCor guarded upload", () => {
  it("rejects when the applicant has no student profile", async () => {
    repo.findStudentByUserId.mockResolvedValue(null);
    const svc = new CorService();
    await expect(svc.uploadCor("user-1", managedFile())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rejects when the entrance exam is not PASSED", async () => {
    repo.checkPassedExam.mockResolvedValue(null);
    const svc = new CorService();
    await expect(svc.uploadCor("user-1", managedFile())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repo.createUploadWithAudit).not.toHaveBeenCalled();
  });

  it("blocks a second upload while a PENDING COR exists", async () => {
    repo.getActiveUploadByStudentId.mockResolvedValue({ id: "cor-pending" });
    const svc = new CorService();
    await expect(svc.uploadCor("user-1", managedFile())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.createUploadWithAudit).not.toHaveBeenCalled();
  });

  it("blocks upload once a COR is already VERIFIED", async () => {
    repo.getVerifiedUploadByStudentId.mockResolvedValue({ id: "cor-verified" });
    const svc = new CorService();
    await expect(svc.uploadCor("user-1", managedFile())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.createUploadWithAudit).not.toHaveBeenCalled();
  });

  it("allows resubmission after a REJECTED COR and persists managed metadata without renaming", async () => {
    // No PENDING and no VERIFIED → resubmission permitted.
    const svc = new CorService();
    await svc.uploadCor("user-1", managedFile());

    expect(repo.createUploadWithAudit).toHaveBeenCalledTimes(1);
    const [uploadData] = repo.createUploadWithAudit.mock.calls[0];
    expect(uploadData).toEqual(
      expect.objectContaining({
        studentId: "student-1",
        filePath: "/root/cor/abc",
        storageKey: "cor/abc",
        storageProvider: "local",
        originalFilename: "cor.pdf",
        detectedMimeType: "application/pdf",
        sizeBytes: 1234,
        checksum: "deadbeef",
        checksumAlgorithm: "sha256",
        uploadedById: "user-1",
        status: "PENDING",
      }),
    );
    // storageKey must keep pointing at the same physical object (no rename).
    expect(uploadData.filePath).toBe("/root/cor/abc");
  });
});

describe("CorService.verifyCor canonical verify + promote", () => {
  const pendingUpload = {
    id: "cor-1",
    status: "PENDING",
    studentId: "student-1",
    student: {
      id: "student-1",
      userId: "user-1",
      admissionStatus: "APPLICANT",
      user: { email: "a@b.c", firstName: "Ana", lastName: "Dela", role: "APPLICANT" },
    },
  };

  beforeEach(() => {
    repo.getUploadById.mockResolvedValue(pendingUpload);
    repo.verifyAndPromote.mockResolvedValue({
      corRecord: { id: "rec-1" },
      updatedStudent: { studentNumber: "2026-GS-00123" },
      updatedUser: { role: "STUDENT" },
    });
  });

  it("requires an explicit Student Number", async () => {
    const svc = new CorService();
    await expect(
      svc.verifyCor("cor-1", "admin-1", { studentNumber: "   " }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.verifyAndPromote).not.toHaveBeenCalled();
  });

  it("does not require or validate Academic Year / Semester (v1 authority)", async () => {
    const svc = new CorService();
    await expect(
      svc.verifyCor("cor-1", "admin-1", { studentNumber: "2026-GS-00123" }),
    ).resolves.toBeTruthy();

    const forwarded = repo.verifyAndPromote.mock.calls[0][3] as Record<
      string,
      unknown
    >;
    expect(forwarded).not.toHaveProperty("academicYear");
    expect(forwarded).not.toHaveProperty("semester");
  });

  it("ignores client method/verificationMethod and legacy term fields", async () => {
    const svc = new CorService();
    await svc.verifyCor("cor-1", "admin-1", {
      studentNumber: " 2026-GS-00123 ",
      method: "OCR",
      verificationMethod: "LEGACY",
      academicYear: "1999-2000",
      semester: "SUMMER",
    } as never);

    const forwarded = repo.verifyAndPromote.mock.calls[0][3] as Record<
      string,
      unknown
    >;
    expect(forwarded).toEqual(
      expect.objectContaining({
        studentNumber: "2026-GS-00123",
        verificationMethod: "ADMIN_MANUAL",
      }),
    );
    expect(forwarded).not.toHaveProperty("academicYear");
    expect(forwarded).not.toHaveProperty("semester");
  });

  it("trims and forwards a confirmed Registration Number", async () => {
    const svc = new CorService();
    await svc.verifyCor("cor-1", "admin-1", {
      studentNumber: "2026-GS-00123",
      registrationNumber: "  REG-123  ",
    });

    const forwarded = repo.verifyAndPromote.mock.calls[0][3] as {
      registrationNumber?: string;
    };
    expect(forwarded.registrationNumber).toBe("REG-123");
  });

  it("normalizes a blank Registration Number to absent, not an empty string", async () => {
    const svc = new CorService();
    await svc.verifyCor("cor-1", "admin-1", {
      studentNumber: "2026-GS-00123",
      registrationNumber: "   ",
    });

    const forwarded = repo.verifyAndPromote.mock.calls[0][3] as {
      registrationNumber?: string;
    };
    expect(forwarded.registrationNumber).toBeUndefined();
    expect(forwarded.registrationNumber).not.toBe("");
  });

  it("rejects a non-PENDING upload", async () => {
    repo.getUploadById.mockResolvedValue({ ...pendingUpload, status: "REJECTED" });
    const svc = new CorService();
    await expect(
      svc.verifyCor("cor-1", "admin-1", { studentNumber: "2026-GS-00123" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.verifyAndPromote).not.toHaveBeenCalled();
  });

  it("rejects when the applicant has not passed the exam", async () => {
    repo.checkPassedExam.mockResolvedValue(null);
    const svc = new CorService();
    await expect(
      svc.verifyCor("cor-1", "admin-1", { studentNumber: "2026-GS-00123" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.verifyAndPromote).not.toHaveBeenCalled();
  });

  it("normalizes to ADMIN_MANUAL and delegates to the canonical transaction", async () => {
    const svc = new CorService();
    const result = await svc.verifyCor("cor-1", "admin-1", {
      studentNumber: " 2026-GS-00123 ",
    });

    expect(repo.verifyAndPromote).toHaveBeenCalledWith(
      "cor-1",
      "student-1",
      "user-1",
      expect.objectContaining({
        studentNumber: "2026-GS-00123",
        verificationMethod: "ADMIN_MANUAL",
      }),
      "admin-1",
    );
    expect(result).toBeTruthy();
  });

  it("maps a duplicate Student Number (P2002) to a controlled conflict", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["student_number"] },
    });
    repo.verifyAndPromote.mockRejectedValue(conflict);
    const svc = new CorService();
    await expect(
      svc.verifyCor("cor-1", "admin-1", { studentNumber: "2026-GS-00123" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("CorService.rejectCor canonical rejection", () => {
  beforeEach(() => {
    repo.getUploadById.mockResolvedValue({
      id: "cor-1",
      status: "PENDING",
      studentId: "student-1",
      student: {
        id: "student-1",
        userId: "user-1",
        admissionStatus: "APPLICANT",
        user: { email: "a@b.c", firstName: "Ana", lastName: "Dela", role: "APPLICANT" },
      },
    });
  });

  it("requires a rejection reason", async () => {
    const svc = new CorService();
    await expect(svc.rejectCor("cor-1", "admin-1", "   ")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.rejectUpload).not.toHaveBeenCalled();
  });

  it("delegates rejection to the canonical transaction with the owning student", async () => {
    repo.rejectUpload.mockResolvedValue({ id: "cor-1", status: "REJECTED" });
    const svc = new CorService();
    await svc.rejectCor("cor-1", "admin-1", "  Illegible scan  ");
    expect(repo.rejectUpload).toHaveBeenCalledWith("cor-1", {
      studentId: "student-1",
      reason: "Illegible scan",
      adminId: "admin-1",
    });
  });
});

describe("CorService.findPendingUploadIdForStudent currentness", () => {
  it("returns the id only when the current submission is PENDING", async () => {
    repo.getCurrentUploadByStudentId.mockResolvedValue({ id: "cor-cur", status: "PENDING" });
    const svc = new CorService();
    await expect(svc.findPendingUploadIdForStudent("student-1")).resolves.toBe("cor-cur");
  });

  it("returns null when the current submission is REJECTED (no fallback to older PENDING)", async () => {
    repo.getCurrentUploadByStudentId.mockResolvedValue({ id: "cor-new", status: "REJECTED" });
    const svc = new CorService();
    await expect(svc.findPendingUploadIdForStudent("student-1")).resolves.toBeNull();
  });

  it("returns null when the current submission is VERIFIED", async () => {
    repo.getCurrentUploadByStudentId.mockResolvedValue({ id: "cor-ver", status: "VERIFIED" });
    const svc = new CorService();
    await expect(svc.findPendingUploadIdForStudent("student-1")).resolves.toBeNull();
  });
});
