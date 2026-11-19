import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { CompExamCertificateService } from "../../../src/services/comp-exam-certificate.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CompExamCertificateService", () => {
  it("throws 404 when student does not exist", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    await expect(
      new CompExamCertificateService().getCertificateFoundationForStudentId("missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns ineligible foundation metadata when student has not passed yet", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentNumber: "2026-0002",
      user: { title: null, firstName: "Juan", lastName: "Dela Cruz", suffix: null },
      program: {
        programName: "Master in Public Administration (MPA)",
        degreeName: "Master in Public Administration",
        majorName: null,
        programCode: "MPA",
      },
      compExamRecords: [
        {
          id: "c1",
          attemptNumber: 1,
          status: "FAILED",
          examDate: null,
          remarks: null,
          certificateNumber: null,
          certificateIssuedAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });

    const svc = new CompExamCertificateService();
    const res = await svc.getCertificateFoundationForStudentId("s1");

    expect(res.eligible).toBe(false);
    expect(res.templateStatus).toBe("TEMPLATE_PENDING");
    expect(res.certificateNumber).toBeNull();
    expect(res.payload).toBeNull();

    await expect(svc.renderCertificatePdf("s1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("assembles certificate foundation payload with Dean signatory for passing students and guards PDF rendering with 501", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "s1",
      studentNumber: "2026-0001",
      user: { title: null, firstName: "Maria", lastName: "Santos", suffix: null },
      program: {
        programName: "Master in Business Administration (MBA)",
        degreeName: "Master in Business Administration",
        majorName: null,
        programCode: "MBA",
      },
      compExamRecords: [
        {
          id: "c2",
          attemptNumber: 2,
          status: "PASSED",
          examDate: new Date("2026-10-15T00:00:00.000Z"),
          remarks: "Passed retake",
          certificateNumber: "WCE-2026-ABCDEF12",
          certificateIssuedAt: new Date("2026-10-20T00:00:00.000Z"),
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
        },
      ],
    });
    prismaMock.systemSetting.findUnique.mockResolvedValue({
      settingValue: JSON.stringify({
        dean: { name: "Dr. Elena Cruz", signatureData: null, updatedAt: null },
      }),
    });

    const svc = new CompExamCertificateService();
    const foundation = await svc.getCertificateFoundationForStudentId("s1");

    expect(foundation.eligible).toBe(true);
    expect(foundation.templateStatus).toBe("TEMPLATE_PENDING");
    expect(foundation.certificateNumber).toBe("WCE-2026-ABCDEF12");
    expect(foundation.payload).toEqual({
      studentName: "Maria Santos",
      studentNumber: "2026-0001",
      programDisplay: "Master in Business Administration",
      attemptNumber: 2,
      examDate: "2026-10-15T00:00:00.000Z",
      recordedAt: "2026-10-20T00:00:00.000Z",
      result: "PASSED",
      remarks: "Passed retake",
      signatoryDeanName: "Dr. Elena Cruz",
    });

    await expect(svc.renderCertificatePdf("s1")).rejects.toMatchObject({
      statusCode: 501,
    });
  });
});
