import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { STUDENT_SIGNATURE, signedRequestEvidence } from "../../fixtures/adviser-request-signed";
import { adviserRequestEvidenceHash, type SignedAdviserRequestState } from "../../../src/services/adviser-request-signed-state";

const prismaMock = vi.hoisted(() => ({
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
  adviserRequestOfficialRecord: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import {
  emptyInstitutionalOfficials,
  INSTITUTIONAL_OFFICIALS_SETTING_KEY,
  loadInstitutionalOfficials,
  updateInstitutionalOfficials,
} from "../../../src/services/institutional-officials.service";
import {
  mapDefenseApplicationToRenderInput,
  mapOfficialSummaryToRenderInput,
} from "../../../src/services/official-defense-document.service";
import { renderDefenseApplication } from "../../../src/documents/official-defense/defense-application/defense-application.renderer";
import { renderOralExamSummary } from "../../../src/documents/official-defense/oral-exam-summary/oral-exam-summary.renderer";
import {
  AdviserRequestRecordService,
  finalizedAdviserRequestSnapshot,
} from "../../../src/services/adviser-request-record.service";
import type {
  OfficialDefenseApplicationDocumentSource,
  OfficialSummaryDocumentSource,
} from "../../../src/services/official-defense-record.service";

const LOGOS = {
  earist: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" as const },
  graduateSchool: { bytes: new Uint8Array([4, 5, 6]), mimeType: "image/jpeg" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.systemSetting.findUnique.mockResolvedValue(null);
  prismaMock.systemSetting.upsert.mockResolvedValue({ settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY });
  prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("InstitutionalOfficialsService", () => {
  it("returns empty configuration when setting is absent", async () => {
    const result = await loadInstitutionalOfficials(prismaMock);
    expect(result).toEqual(emptyInstitutionalOfficials());
  });

  it("validates, persists, and audits names and PNG/JPEG signatures", async () => {
    const updated = await updateInstitutionalOfficials(
      {
        dean: { name: "Dr. Juan Dela Cruz", signatureData: STUDENT_SIGNATURE },
        vpaa: { name: "Dr. Maria Santos", signatureData: STUDENT_SIGNATURE },
        president: { name: "Engr. Rogelio Reyes", signatureData: null },
      },
      "admin-1",
      prismaMock,
    );

    expect(updated.dean.name).toBe("Dr. Juan Dela Cruz");
    expect(updated.dean.signatureData).toBe(STUDENT_SIGNATURE);
    expect(updated.dean.updatedAt).toBeTruthy();
    expect(updated.vpaa.name).toBe("Dr. Maria Santos");
    expect(updated.president.name).toBe("Engr. Rogelio Reyes");
    expect(updated.president.signatureData).toBeNull();
    expect(prismaMock.systemSetting.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          actionType: "INSTITUTIONAL_OFFICIALS_UPDATED",
        }),
      }),
    );
  });

  it("rejects invalid signature images with 422", async () => {
    await expect(
      updateInstitutionalOfficials(
        { dean: { name: "Dr. Dean", signatureData: "data:image/png;base64,AQID" } },
        "admin-1",
        prismaMock,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(prismaMock.systemSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("Official defense forms integration with O.R. No. and Institutional Officials", () => {
  it("maps O.R. No., P 900.00 Amount Paid, and configured officials + signatures to GS-006/007", async () => {
    const src: OfficialDefenseApplicationDocumentSource = {
      scheduleId: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      defenseDate: "2026-11-20T00:00:00.000Z",
      defenseTime: "1970-01-01T10:00:00.000Z",
      venueOrLink: "Room 204",
      studentName: "Alex Student",
      studentNumber: "2026-0042",
      cellphone: "09170001111",
      studentEmail: "alex.student@gmail.com",
      programName: "Master of Arts in Education",
      programType: "MASTERS",
      applicationSubmittedAt: "2026-11-17T01:00:00.000Z",
      assignments: [
        { panelAssignmentId: "c1", userId: "u1", role: "CHAIRMAN", name: "Chair One", createdAt: "2026-11-01T00:00:00Z" },
        { panelAssignmentId: "p1", userId: "u2", role: "PANELIST", name: "Panel 1", createdAt: "2026-11-01T00:01:00Z" },
        { panelAssignmentId: "p2", userId: "u3", role: "PANELIST", name: "Panel 2", createdAt: "2026-11-01T00:02:00Z" },
        { panelAssignmentId: "p3", userId: "u4", role: "PANELIST", name: "Panel 3", createdAt: "2026-11-01T00:03:00Z" },
        { panelAssignmentId: "a1", userId: "u5", role: "ADVISER", name: "Adviser One", createdAt: "2026-11-01T00:04:00Z" },
        { panelAssignmentId: "f1", userId: "u6", role: "FACILITATOR", name: "Facilitator One", createdAt: "2026-11-01T00:05:00Z" },
        { panelAssignmentId: "r1", userId: "u7", role: "RAPPORTEUR", name: "Rapporteur One", createdAt: "2026-11-01T00:06:00Z" },
      ],
      officialReceiptNumber: "OR-2026-889900",
      amountPaid: "P 900.00",
      deanName: "Dr. Juan Dela Cruz",
      vicePresidentName: "Dr. Maria Santos",
      presidentName: "Engr. Rogelio Reyes",
      deanSignatureData: STUDENT_SIGNATURE,
      vicePresidentSignatureData: STUDENT_SIGNATURE,
      presidentSignatureData: STUDENT_SIGNATURE,
    };

    const input = mapDefenseApplicationToRenderInput(src, LOGOS);
    expect(input.officialReceiptNumber).toBe("OR-2026-889900");
    expect(input.amountPaid).toBe("P 900.00");
    expect(input.deanName).toBe("Dr. Juan Dela Cruz");
    expect(input.vicePresidentName).toBe("Dr. Maria Santos");
    expect(input.presidentName).toBe("Engr. Rogelio Reyes");
    expect(input.deanSignature?.mimeType).toBe("image/png");
    expect(input.vicePresidentSignature?.mimeType).toBe("image/png");
    expect(input.presidentSignature?.mimeType).toBe("image/png");

    // Verify rendering succeeds with real assets + signature images on 1 A4 page
    const { loadOfficialFormLogos } = await import("../../../src/services/official-form-assets");
    const realLogos = await loadOfficialFormLogos();
    const pdf = await renderDefenseApplication({ ...input, logos: realLogos });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });

  it("maps configured Dean name and signature to GS-011 and renders cleanly", async () => {
    const src: OfficialSummaryDocumentSource = {
      scheduleId: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      summaryId: "sum-1",
      adviserName: "Adviser One",
      deanName: "Dr. Juan Dela Cruz",
      deanSignatureData: STUDENT_SIGNATURE,
      snapshot: {
        schemaVersion: 1,
        scheduleId: "sched-1",
        defenseType: "PROPOSAL_DEFENSE",
        studentName: "Alex Student",
        studentNumber: "2026-0042",
        program: "Master of Arts in Education",
        defenseDate: "2026-11-20T00:00:00.000Z",
        defenseTime: null,
        venueOrLink: null,
        evaluatorCount: 1,
        overallAverage: 1.5,
        generatedAt: "2026-11-20T10:00:00.000Z",
        evaluators: [
          {
            panelAssignmentId: "p1",
            userId: "u1",
            evaluatorName: "Chair One",
            functionalRole: "CHAIRMAN",
            groupIValue: 1.5,
            groupIIValue: 1.5,
            averageValue: 1.5,
            overallValue: null,
            rating: null,
            recommendations: null,
            scoringVersion: "INSTITUTIONAL_MATRIX_V2",
          },
        ],
      },
    };

    const input = mapOfficialSummaryToRenderInput(src, LOGOS);
    expect(input.deanName).toBe("Dr. Juan Dela Cruz");
    expect(input.deanSignature?.mimeType).toBe("image/png");

    const { loadOfficialFormLogos } = await import("../../../src/services/official-form-assets");
    const realLogos = await loadOfficialFormLogos();
    const pdf = await renderOralExamSummary({ ...input, logos: realLogos });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });

  it("snapshots and renders configured Dean name and signature on finalized GS-020 Adviser Request PDF", async () => {
    const signed = signedRequestEvidence({
      id: "req-gs020",
      studentId: "student-1",
      requestedAdviserId: "adviser-user",
      reason: "Research alignment.",
      requestDate: new Date("2026-09-25"),
      sourceDefenseScheduleId: "schedule-1",
    });
    const finalizedAt = new Date("2026-11-17T01:00:00.000Z");
    const snapshot = finalizedAdviserRequestSnapshot(
      signed.payload as unknown as SignedAdviserRequestState,
      new Date("2026-11-16T12:00:00.000Z"),
      "admin-1",
      finalizedAt,
      { name: "Dr. Juan Dela Cruz", signatureData: STUDENT_SIGNATURE },
    );

    expect(snapshot.printedDeanName).toBe("Dr. Juan Dela Cruz");
    expect(snapshot.printedDeanSignature).toBe(STUDENT_SIGNATURE);

    prismaMock.adviserRequestOfficialRecord.findUnique.mockResolvedValue({
      requestId: "req-gs020",
      studentUserId: "student-user",
      requestedAdviserId: "adviser-user",
      snapshot,
      signatureData: STUDENT_SIGNATURE,
      evidenceHash: adviserRequestEvidenceHash(snapshot, STUDENT_SIGNATURE),
      finalizedAt,
      request: { status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" },
    });

    const service = new AdviserRequestRecordService();
    const { pdf } = await service.generatePdf("req-gs020", { userId: "admin-1", role: "ADMIN" });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });
});
