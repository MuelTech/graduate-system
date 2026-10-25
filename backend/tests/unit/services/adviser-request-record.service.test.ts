import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { signedRequestEvidence, STUDENT_SIGNATURE } from "../../fixtures/adviser-request-signed";
import { adviserRequestEvidenceHash, type SignedAdviserRequestState } from "../../../src/services/adviser-request-signed-state";

const db = vi.hoisted(() => ({ adviserRequestOfficialRecord: { findUnique: vi.fn(), findMany: vi.fn() },
  student: { findUnique: vi.fn() }, adviserAssignment: { findFirst: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { AdviserRequestRecordService, finalizedAdviserRequestSnapshot } from "../../../src/services/adviser-request-record.service";
import * as renderer from "../../../src/documents/official-defense/adviser-request/adviser-request.renderer";

function officialRecord() {
  const signed = signedRequestEvidence({ id: "req-1", studentId: "student-1", requestedAdviserId: "adviser-user",
    reason: "Exact signed reason.", requestDate: new Date("2026-09-25"), sourceDefenseScheduleId: "schedule-1" });
  const finalizedAt = new Date("2026-09-27T08:00:00.123Z");
  const snapshot = finalizedAdviserRequestSnapshot(signed.payload as unknown as SignedAdviserRequestState,
    new Date("2026-09-26T08:00:00Z"), "admin-user", finalizedAt);
  return { requestId: "req-1", studentUserId: "student-user", requestedAdviserId: "adviser-user",
    snapshot, signatureData: STUDENT_SIGNATURE, evidenceHash: adviserRequestEvidenceHash(snapshot, STUDENT_SIGNATURE), finalizedAt,
    request: { status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" } };
}

describe("GS020-1B finalized Adviser Request authorization and PDF mapping", () => {
  const service = new AdviserRequestRecordService();
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    db.adviserRequestOfficialRecord.findUnique.mockResolvedValue(officialRecord());
    db.adviserRequestOfficialRecord.findMany.mockResolvedValue([officialRecord()]);
    db.student.findUnique.mockRejectedValue(new Error("Mutable profiles must not be consulted"));
    db.adviserAssignment.findFirst.mockRejectedValue(new Error("Current Adviser must not be consulted"));
  });

  it.each([
    { userId: "student-user", role: "STUDENT" }, { userId: "adviser-user", role: "PANELIST" },
    { userId: "admin-user", role: "ADMIN" },
  ])("allows exact authorized actor $role/$userId to generate a real A4 PDF", async actor => {
    const { pdf, filename } = await service.generatePdf("req-1", actor);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    expect(filename).toBe("Sam-Student-Adviser-Request.pdf");
  });

  it.each([
    { userId: "other-student", role: "STUDENT" }, { userId: "other-adviser", role: "PANELIST" },
    { userId: "title-chairman", role: "PANELIST" }, { userId: "rapporteur", role: "PANELIST" },
    { userId: "facilitator", role: "PANELIST" }, { userId: "adviser-user", role: "STUDENT" },
    { userId: "student-user", role: "PANELIST" }, { userId: "adviser-user", role: "APPLICANT" },
    { userId: "", role: "ADMIN" },
  ])("denies $role/$userId regardless of committee participation", async actor => {
    await expect(service.generatePdf("req-1", actor)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["STUDENT", "PANELIST", "ADMIN"])("scopes %s record history independently of active assignments", async role => {
    await service.list({ userId: "actor-id", role });
    const where = db.adviserRequestOfficialRecord.findMany.mock.calls[0][0].where;
    expect(where.request).toEqual({ status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" });
    if (role === "STUDENT") expect(where.studentUserId).toBe("actor-id");
    if (role === "PANELIST") expect(where.requestedAdviserId).toBe("actor-id");
    if (role === "ADMIN") { expect(where.studentUserId).toBeUndefined(); expect(where.requestedAdviserId).toBeUndefined(); }
  });

  it("returns safe metadata without signature data, evidence, hashes, or internal storage fields", async () => {
    const records = await service.list({ userId: "student-user", role: "STUDENT" });
    expect(records).toEqual([{ id: "req-1", studentName: "Sam Student", requestedAdviserName: "Ana Chair",
      requestDate: "25 September 2026", finalizedAt: "2026-09-27T08:00:00.123Z", status: "APPROVED", pdfAvailable: true }]);
    expect(JSON.stringify(records)).not.toMatch(/base64|signature|snapshot|evidenceHash|storage|payload/);
  });

  it("maps only immutable snapshot values and exact evidence to the unchanged renderer", async () => {
    const spy = vi.spyOn(renderer, "renderAdviserRequest");
    await service.generatePdf("req-1", { userId: "student-user", role: "STUDENT" });
    expect(spy).toHaveBeenCalledWith({ logos: expect.any(Object), requestDate: "25 September 2026",
      requestedAdviserName: "Ana Chair", reason: "Exact signed reason.", studentName: "Sam Student", studentNumber: "2026-001",
      programName: "MIT", studentSignature: { mimeType: "image/png", bytes: expect.any(Uint8Array) } });
    expect(spy.mock.calls[0][0]).not.toHaveProperty("deanName");
    expect(spy.mock.calls[0][0]).not.toHaveProperty("deanSignature");
    expect(db.student.findUnique).not.toHaveBeenCalled();
    expect(db.adviserAssignment.findFirst).not.toHaveBeenCalled();
  });

  it("does not manufacture a PDF for an approved legacy request without a finalized record", async () => {
    db.adviserRequestOfficialRecord.findUnique.mockResolvedValue(null);
    db.adviserRequestOfficialRecord.findMany.mockResolvedValue([]);
    await expect(service.generatePdf("legacy-approved", { userId: "admin-user", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await service.list({ userId: "admin-user", role: "ADMIN" })).toEqual([]);
  });

  it.each(["PENDING", "REJECTED"])("fails closed for %s request state", async status => {
    db.adviserRequestOfficialRecord.findUnique.mockResolvedValue({ ...officialRecord(), request: { ...officialRecord().request, status } });
    await expect(service.generatePdf("req-1", { userId: "admin-user", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each(["revision", "contractVersion", "studentName", "printedDeanName", "reason"])("refuses changed or unsupported snapshot %s", async field => {
    const record = officialRecord();
    db.adviserRequestOfficialRecord.findUnique.mockResolvedValue({ ...record, snapshot: { ...record.snapshot, [field]: "Changed" } });
    await expect(service.generatePdf("req-1", { userId: "admin-user", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects corrupt stored image evidence and reports it as unavailable", async () => {
    const record = officialRecord();
    const signatureData = "data:image/png;base64,AQID";
    const corrupt = { ...record, signatureData, evidenceHash: adviserRequestEvidenceHash(record.snapshot, signatureData) };
    db.adviserRequestOfficialRecord.findUnique.mockResolvedValue(corrupt);
    db.adviserRequestOfficialRecord.findMany.mockResolvedValue([corrupt]);
    await expect(service.generatePdf("req-1", { userId: "admin-user", role: "ADMIN" })).rejects.toThrow(/Student signature/);
    expect((await service.list({ userId: "admin-user", role: "ADMIN" }))[0].pdfAvailable).toBe(false);
  });

  it("accepts a validated JPEG as explicit Student signature evidence", async () => {
    const { validateStudentRequestSignature } = await import("../../../src/services/adviser-request-signed-state");
    const jpeg = await readFile(path.resolve(__dirname, "../../../assets/official-forms/earist-logo.jpg"));
    expect((await validateStudentRequestSignature(`data:image/jpeg;base64,${jpeg.toString("base64")}`)).mimeType).toBe("image/jpeg");
  });
});
