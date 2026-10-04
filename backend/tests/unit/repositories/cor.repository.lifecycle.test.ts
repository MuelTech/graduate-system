import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    corUpload: { updateMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    corRecord: { create: vi.fn() },
    student: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
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

function authorizeHappyPath() {
  tx().corUpload.findFirst.mockResolvedValue({ id: uploadId });
  tx().corUpload.updateMany.mockResolvedValue({ count: 1 });
  tx().student.findUnique.mockResolvedValue({ id: studentId, admissionStatus: "APPLICANT" });
  tx().entranceExamApplication.findFirst.mockResolvedValue({ id: "exam-1", status: "PASSED" });
  tx().user.findUnique.mockResolvedValue({ id: userId, role: "APPLICANT" });
  tx().student.updateMany.mockResolvedValue({ count: 1 });
  tx().user.updateMany.mockResolvedValue({ count: 1 });
  tx().corRecord.create.mockResolvedValue({ id: "rec-1", isAdminVerified: true });
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeHappyPath();
});

describe("CorRepository.verifyAndPromote authority + currentness", () => {
  it("locks the student row, claims the exact current upload, and promotes APPLICANT->STUDENT atomically", async () => {
    const repo = new CorRepository();
    const result = await repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId);

    expect(tx().$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx().corUpload.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(tx().corUpload.updateMany).toHaveBeenCalledWith({
      where: { id: uploadId, studentId, status: "PENDING" },
      data: { status: "VERIFIED" },
    });
    expect(tx().student.updateMany).toHaveBeenCalledWith({
      where: { id: studentId, admissionStatus: "APPLICANT" },
      data: expect.objectContaining({
        admissionStatus: "ENROLLED",
        studentNumber: verifyData.studentNumber,
      }),
    });
    expect(tx().user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, role: "APPLICANT" },
      data: { role: "STUDENT" },
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
    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
    expect(result).toBeTruthy();
  });

  it("fails closed when the supplied upload is not the student's current submission", async () => {
    tx().corUpload.findFirst.mockResolvedValue({ id: "cor-newer" });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().corUpload.updateMany).not.toHaveBeenCalled();
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when the upload is no longer PENDING (concurrent verify)", async () => {
    tx().corUpload.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().corRecord.create).not.toHaveBeenCalled();
    expect(tx().student.updateMany).not.toHaveBeenCalled();
    expect(tx().user.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed for a DISQUALIFIED student and does not promote", async () => {
    tx().student.findUnique.mockResolvedValue({ id: studentId, admissionStatus: "DISQUALIFIED" });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().student.updateMany).not.toHaveBeenCalled();
    expect(tx().user.updateMany).not.toHaveBeenCalled();
    expect(tx().corRecord.create).not.toHaveBeenCalled();
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed for an ENROLLED student (no second promotion)", async () => {
    tx().student.findUnique.mockResolvedValue({ id: studentId, admissionStatus: "ENROLLED" });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when the User role is not APPLICANT", async () => {
    for (const role of ["STUDENT", "ADMIN", "PANELIST"]) {
      vi.clearAllMocks();
      authorizeHappyPath();
      tx().user.findUnique.mockResolvedValue({ id: userId, role });
      const repo = new CorRepository();

      await expect(
        repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(tx().student.updateMany).not.toHaveBeenCalled();
      expect(tx().corRecord.create).not.toHaveBeenCalled();
    }
  });

  it("fails closed when the entrance exam is not PASSED", async () => {
    tx().entranceExamApplication.findFirst.mockResolvedValue(null);
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when the conditional student write affects 0 rows", async () => {
    tx().student.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().user.updateMany).not.toHaveBeenCalled();
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });

  it("fails closed when the conditional user write affects 0 rows", async () => {
    tx().user.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.verifyAndPromote(uploadId, studentId, userId, verifyData, adminId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().corRecord.create).not.toHaveBeenCalled();
  });
});

describe("CorRepository.rejectUpload currentness", () => {
  it("rejects only the current PENDING upload with reason + audit atomically", async () => {
    tx().corUpload.findFirst.mockResolvedValue({ id: uploadId });
    tx().corUpload.updateMany.mockResolvedValue({ count: 1 });
    const repo = new CorRepository();

    await repo.rejectUpload(uploadId, { studentId, reason: "Illegible scan", adminId });

    expect(tx().$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx().corUpload.updateMany).toHaveBeenCalledWith({
      where: { id: uploadId, studentId, status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        rejectionReason: "Illegible scan",
        reviewedById: adminId,
        reviewedAt: expect.any(Date),
      }),
    });
    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the supplied upload is not the current submission", async () => {
    tx().corUpload.findFirst.mockResolvedValue({ id: "cor-newer" });
    const repo = new CorRepository();

    await expect(
      repo.rejectUpload(uploadId, { studentId, reason: "x", adminId }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().corUpload.updateMany).not.toHaveBeenCalled();
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed when the current upload is not PENDING", async () => {
    tx().corUpload.findFirst.mockResolvedValue({ id: uploadId });
    tx().corUpload.updateMany.mockResolvedValue({ count: 0 });
    const repo = new CorRepository();

    await expect(
      repo.rejectUpload(uploadId, { studentId, reason: "x", adminId }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });
});

describe("CorRepository.getPendingUploads current actionable rows", () => {
  it("shows a current PENDING row but hides a stale historical PENDING row", async () => {
    // First call: distinct student ids that have any PENDING row.
    prismaMock.corUpload.findMany
      .mockResolvedValueOnce([{ studentId: "s1" }, { studentId: "s2" }])
      // Second call: all uploads for those students, ordered newest-first per student.
      .mockResolvedValueOnce([
        { id: "s2-new", studentId: "s2", status: "REJECTED", student: { id: "s2" } },
        { id: "s2-old", studentId: "s2", status: "PENDING", student: { id: "s2" } },
        { id: "s1-cur", studentId: "s1", status: "PENDING", student: { id: "s1" } },
      ]);

    const repo = new CorRepository();
    const result = await repo.getPendingUploads();

    expect(result.map((r: { id: string }) => r.id)).toEqual(["s1-cur"]);
  });

  it("exposes persisted extraction suggestions and extractor/parser versions to the pending review path", async () => {
    prismaMock.corUpload.findMany
      .mockResolvedValueOnce([{ studentId: "s1" }])
      .mockResolvedValueOnce([]);

    const repo = new CorRepository();
    await repo.getPendingUploads();

    const secondCall = prismaMock.corUpload.findMany.mock.calls[1]?.[0] as {
      select: { extraction: { select: Record<string, unknown> } };
    };
    expect(secondCall.select.extraction.select).toEqual(
      expect.objectContaining({
        status: true,
        method: true,
        processedAt: true,
        diagnostic: true,
        suggestions: true,
        parserVersion: true,
        extractorVersion: true,
      }),
    );
  });
});
