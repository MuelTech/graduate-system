import { beforeEach, describe, expect, it, vi } from "vitest";

const cor = vi.hoisted(() => ({
  verifyCor: vi.fn(),
  rejectCor: vi.fn(),
  findPendingUploadIdForStudent: vi.fn(),
}));

vi.mock("../../../src/services/cor.service", () => ({
  CorService: class {
    verifyCor = cor.verifyCor;
    rejectCor = cor.rejectCor;
    findPendingUploadIdForStudent = cor.findPendingUploadIdForStudent;
  },
}));

const repo = vi.hoisted(() => ({
  findStudentById: vi.fn(),
  findActivityLog: vi.fn(),
  createAuditLog: vi.fn(),
  updateAlignmentStatus: vi.fn(),
  updateWaiverStatus: vi.fn(),
}));

vi.mock("../../../src/repositories/admin-applicant.repository", () => ({
  AdminApplicantRepository: class {
    findStudentById = repo.findStudentById;
    findActivityLog = repo.findActivityLog;
    createAuditLog = repo.createAuditLog;
    updateAlignmentStatus = repo.updateAlignmentStatus;
    updateWaiverStatus = repo.updateWaiverStatus;
  },
}));

import { AdminApplicantService } from "../../../src/services/admin-applicant.service";

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    admissionStatus: "APPLICANT",
    studentNumber: null,
    enrollmentDate: null,
    cellphone: null,
    dateOfBirth: null,
    pinnacleApplicantId: "P-1",
    alignmentStatus: "ALIGNED",
    isProgramAligned: true,
    undergraduateProgram: null,
    bridgingWaiver: null,
    examApplications: [],
    corUploads: [],
    user: { firstName: "Ana", lastName: "Dela", email: "ana@example.com" },
    program: { id: "prog-1", programName: "MSIT" },
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.findActivityLog.mockResolvedValue([]);
});

describe("AdminApplicantService COR delegation to canonical authority", () => {
  it("legacy cor/verify resolves the current PENDING upload and delegates", async () => {
    repo.findStudentById.mockResolvedValue(student());
    cor.findPendingUploadIdForStudent.mockResolvedValue("cor-pending");
    cor.verifyCor.mockResolvedValue({ studentNumber: "2026-GS-1" });

    const svc = new AdminApplicantService();
    const result = await svc.verifyCor("student-1", "admin-1", {
      verificationMethod: "manual",
      studentNumber: "2026-GS-1",
    } as never);

    expect(cor.findPendingUploadIdForStudent).toHaveBeenCalledWith("student-1");
    expect(cor.verifyCor).toHaveBeenCalledWith(
      "cor-pending",
      "admin-1",
      expect.objectContaining({ studentNumber: "2026-GS-1" }),
    );
    expect(result.corStatus).toBe("VERIFIED");
  });

  it("legacy cor/verify fails when there is no pending upload", async () => {
    repo.findStudentById.mockResolvedValue(student());
    cor.findPendingUploadIdForStudent.mockResolvedValue(null);

    const svc = new AdminApplicantService();
    await expect(
      svc.verifyCor("student-1", "admin-1", { verificationMethod: "manual" } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(cor.verifyCor).not.toHaveBeenCalled();
  });

  it("legacy cor/reject delegates to canonical rejection", async () => {
    repo.findStudentById.mockResolvedValue(student());
    cor.findPendingUploadIdForStudent.mockResolvedValue("cor-pending");
    cor.rejectCor.mockResolvedValue({ id: "cor-pending", status: "REJECTED" });

    const svc = new AdminApplicantService();
    const result = await svc.rejectCor("student-1", "admin-1", { reason: "Blurry" } as never);

    expect(cor.rejectCor).toHaveBeenCalledWith("cor-pending", "admin-1", "Blurry");
    expect(result.corStatus).toBe("REJECTED");
  });

  it("legacy /promote cannot independently promote an applicant", async () => {
    repo.findStudentById.mockResolvedValue(student());
    const svc = new AdminApplicantService();

    await expect(
      svc.promoteToStudent("student-1", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("legacy /promote is idempotent/read-only for an already enrolled student", async () => {
    repo.findStudentById.mockResolvedValue(
      student({ admissionStatus: "ENROLLED", studentNumber: "2026-GS-1" }),
    );
    const svc = new AdminApplicantService();

    const result = await svc.promoteToStudent("student-1", "admin-1");
    expect(result.studentNumber).toBe("2026-GS-1");
  });
});

describe("AdminApplicantService COR DTO privacy + history", () => {
  it("does not serialize raw filePath or storage keys and exposes safe history", async () => {
    repo.findStudentById.mockResolvedValue(
      student({
        corUploads: [
          {
            id: "cor-2",
            status: "PENDING",
            ocrStatus: "PENDING",
            filePath: "D:\\private\\root\\cor\\abc",
            storageKey: "cor/abc",
            storageProvider: "local",
            originalFilename: "cor.pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 10,
            uploadedAt: new Date("2026-02-01"),
            reviewedAt: null,
            rejectionReason: null,
            reviewedBy: null,
            corRecord: null,
          },
          {
            id: "cor-1",
            status: "REJECTED",
            ocrStatus: "PENDING",
            filePath: "D:\\private\\root\\cor\\old",
            storageKey: "cor/old",
            storageProvider: "local",
            originalFilename: "old.pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 20,
            uploadedAt: new Date("2026-01-01"),
            reviewedAt: new Date("2026-01-02"),
            rejectionReason: "Illegible",
            reviewedBy: { firstName: "Ad", lastName: "Min" },
            corRecord: null,
          },
        ],
      }),
    );

    const svc = new AdminApplicantService();
    const detail = await svc.getApplicantDetail("student-1");
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("D:\\\\private");
    expect(serialized).not.toContain("storageKey");
    expect(detail.corUploads).toHaveLength(2);
    expect(detail.corUploads[0].status).toBe("PENDING");
    expect(detail.corUploads[0].isCurrent).toBe(true);
    expect(detail.corUploads[1].rejectionReason).toBe("Illegible");
    expect(detail.corUploads[1].isCurrent).toBe(false);
  });
});
