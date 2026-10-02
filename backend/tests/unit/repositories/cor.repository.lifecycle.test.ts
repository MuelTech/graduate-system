import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    corUpload: { updateMany: vi.fn(), findUnique: vi.fn() },
    corRecord: { create: vi.fn(), findFirst: vi.fn() },
    student: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
    entranceExamApplication: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    corUpload: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { CorRepository } from "../../../src/repositories/cor.repository";

const adminId = "admin-1";
const studentId = "student-1";
const userId = "user-1";
const uploadId = "cor-1";

const verifyData = {
  studentNumber: "2026-GS-00123",
  academicYear: "2026-2027",
  semester: "FIRST_SEM",
  registrationNumber: "",
  verificationMethod: "ADMIN_MANUAL",
};

function tx() {
  return prismaMock.__tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  tx().corUpload.updateMany.mockResolvedValue({ count: 1 });
  tx().student.findUnique.mockResolvedValue({ id: studentId, admissionStatus: "APPLICANT" });
  tx().entranceExamApplication.findFirst.mockResolvedValue({ id: "exam-1", status: "PASSED" });
  tx().corRecord.create.mockResolvedValue({ id: "rec-1", isAdminVerified: true });
  tx().student.update.mockResolvedValue({ id: studentId, studentNumber: verifyData.studentNumber });
  tx().user.update.mockResolvedValue({ id: userId, role: "STUDENT" });
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("CorRepository.verifyAndPromote canonical transaction", () => {
  it("marks the exact PENDING upload, records COR data, promotes and audits atomically", async () => {
    const repo = new CorRepository();
    const result = await repo.verifyAndPromote(
      uploadId,
      studentId,
      userId,
      verifyData,
      adminId,
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx().corUpload.updateMany).toHaveBeenCalledWith({
      where: { id: uploadId, studentId, status: "PENDING" },
      data: { status: "VERIFIED" },
    });
    expect(tx().corRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        corUploadId: uploadId,
        studentId,
        isAdminVerified: true,
        verificationMethod: "ADMIN_MANUAL",
        verifiedById: adminId,
      }),
    });
    expect(tx().student.update).toHaveBeenCalledWith({
      where: { id: studentId },
      data: expect.objectContaining({
        admissionStatus: "ENROLLED",
        studentNumber: verifyData.studentNumber,
      }),
    });
    expect(tx().user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { role: "STUDENT" },
    });
    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
    expect(result).toBeTruthy();
  });

  it("fails closed when the upload is no longer PENDING (concurrent verify)", async () => {
    tx().corUpload.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().corRecord.create).not.toHaveBeenCalled();
    expect(tx().student.update).not.toHaveBeenCalled();
    expect(tx().user.update).not.toHaveBeenCalled();
  });

  it("fails closed when the entrance exam is not PASSED", async () => {
    tx().entranceExamApplication.findFirst.mockResolvedValue(null);
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when the student is already enrolled", async () => {
    tx().student.findUnique.mockResolvedValue({ id: studentId, admissionStatus: "ENROLLED" });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });
});

describe("CorRepository.rejectUpload canonical transaction", () => {
  it("rejects only the exact PENDING upload and records reason + audit atomically", async () => {
    tx().corUpload.updateMany.mockResolvedValue({ count: 1 });
    const repo = new CorRepository();

    await repo.rejectUpload(uploadId, { reason: "Illegible scan", adminId });

    expect(tx().corUpload.updateMany).toHaveBeenCalledWith({
      where: { id: uploadId, status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectionReason: "Illegible scan",
        reviewedById: adminId,
        reviewedAt: expect.any(Date),
      }),
    });
    expect(tx().auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetTable: "cor_uploads",
        targetId: uploadId,
        actionType: "COR_REJECT",
      }),
    });
  });

  it("fails closed when the upload is not PENDING", async () => {
    tx().corUpload.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.rejectUpload(uploadId, { reason: "x", adminId }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });
});
