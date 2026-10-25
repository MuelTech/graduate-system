import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_SIGNATURE, REVIEW_CONTEXT, signedRequestEvidence } from "../../fixtures/adviser-request-signed";
import { MAX_SIGNATURE_BYTES } from "../../../src/services/official-form-signature";
import { assertSignedAdviserRequest, validateStudentRequestSignature } from "../../../src/services/adviser-request-signed-state";

const db = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(), adviserRequest: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    adviserAssignment: { findFirst: vi.fn(), create: vi.fn() }, panelist: { findUnique: vi.fn() },
    adviserRequestSignedState: { findUnique: vi.fn() }, adviserRequestOfficialRecord: { create: vi.fn() },
  };
  return { student: { findUnique: vi.fn() }, adviserAssignment: { findFirst: vi.fn() },
    adviserRequest: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, $transaction: vi.fn(), tx };
});
vi.mock("../../../src/config/database", () => ({ default: db }));
import { AdviserRequestService } from "../../../src/services/adviser-request.service";

const submission = () => ({ requestedAdviserId: "adv-user", reason: "Please guide my research.",
  signatureData: STUDENT_SIGNATURE, reviewedContext: { ...REVIEW_CONTEXT } });
const request = () => ({ id: "req-1", studentId: "student-1", requestedAdviserId: "adv-user", reason: "Please guide my research.",
  sourceDefenseScheduleId: "schedule-1", requestDate: new Date("2026-09-25"), status: "PENDING",
  adviserStatus: "CONFORMED", adviserRespondedAt: new Date("2026-09-26T08:00:00Z"), deanStatus: "PENDING" });

describe("GS020-1B exact Student signing and atomic finalization", () => {
  let service: AdviserRequestService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new AdviserRequestService();
    vi.spyOn(service, "getPassedTitleDefenseContext").mockResolvedValue({
      scheduleId: "schedule-1", conclusionId: "conclusion-1", selectedTitleId: null, selectedTitleText: null,
      candidates: [{ userId: "adv-user", name: "Ana Chair", defenseRole: "PANELIST", specialization: null,
        officeAffiliation: null, isExternal: false, isAvailableAsAdviser: true }], seats: [],
    });
    db.student.findUnique.mockResolvedValue({ id: "student-1", userId: "student-user", studentNumber: "2026-001",
      user: { firstName: "Sam", lastName: "Student" }, program: { programName: "MIT" } });
    db.adviserAssignment.findFirst.mockResolvedValue(null);
    db.adviserRequest.findFirst.mockResolvedValue(null);
    db.tx.adviserRequest.findFirst.mockResolvedValue(null);
    db.tx.adviserRequest.create = db.adviserRequest.create;
    db.adviserRequest.create.mockImplementation(async ({ data }) => {
      const { signedState, ...safe } = data;
      return safe;
    });
    db.adviserRequest.findUnique.mockResolvedValue(request());
    db.tx.adviserRequest.findUnique.mockResolvedValue(request());
    db.tx.adviserRequest.updateMany.mockResolvedValue({ count: 1 });
    db.tx.adviserAssignment.findFirst.mockResolvedValue(null);
    db.tx.panelist.findUnique.mockResolvedValue({ isExternal: false });
    db.tx.adviserRequestSignedState.findUnique.mockResolvedValue(signedRequestEvidence(request() as never));
    db.$transaction.mockImplementation(async fn => fn(db.tx));
  });

  it("creates one signing-bound request with server-owned identity, date, and evidence, without exposing evidence", async () => {
    const body = { ...submission(), signedAt: "2000-01-01", studentName: "Forged name" };
    const result = await service.createRequest("student-user", body);
    const data = db.adviserRequest.create.mock.calls[0][0].data;
    const evidence = data.signedState.create;
    const state = evidence.payload;
    expect(state).toMatchObject({ ...REVIEW_CONTEXT, requestId: data.id, studentUserId: "student-user",
      requestedAdviserId: "adv-user", sourceConclusionId: "conclusion-1", reason: body.reason });
    expect(state.signedAt).toBe(evidence.signedAt.toISOString());
    expect(state.signedAt).not.toBe(body.signedAt);
    expect(evidence.signatureData).toBe(STUDENT_SIGNATURE);
    expect(assertSignedAdviserRequest(data, { ...evidence, requestId: data.id })).toEqual(state);
    expect(JSON.stringify(result)).not.toContain("base64");
    expect(JSON.stringify(result)).not.toContain("signedState");
    expect(db.tx.adviserRequestOfficialRecord.create).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "not a signature", "data:image/gif;base64,AAAA", "data:image/png;base64,AQID"])("rejects missing/invalid evidence %s", async signatureData => {
    await expect(service.createRequest("student-user", { ...submission(), signatureData })).rejects.toThrow(/Student signature/);
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });

  it("rejects oversized and image-header-only evidence", async () => {
    const oversized = Buffer.alloc(MAX_SIGNATURE_BYTES + 1, 1);
    await expect(validateStudentRequestSignature(`data:image/png;base64,${oversized.toString("base64")}`)).rejects.toMatchObject({ statusCode: 413 });
    await expect(validateStudentRequestSignature("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects another Student's request and an ineligible Adviser", async () => {
    await expect(service.createRequest("student-user", { ...submission(), studentId: "another-student" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createRequest("student-user", { ...submission(), requestedAdviserId: "unrelated-user" })).rejects.toThrow(/eligible member/);
  });

  it.each(Object.keys(REVIEW_CONTEXT))("rejects stale or forged reviewed %s", async field => {
    await expect(service.createRequest("student-user", {
      ...submission(), reviewedContext: { ...REVIEW_CONTEXT, [field]: "Changed value" },
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a request that cannot fit the accepted official form before it is signed into persistence", async () => {
    await expect(service.createRequest("student-user", { ...submission(), reason: "Very long reason ".repeat(100) })).rejects.toThrow(/Request reason exceeds/);
    expect(db.adviserRequest.create).not.toHaveBeenCalled();
  });

  it("rechecks under the Student lock so concurrent signed submissions create only one open request", async () => {
    let serialized = Promise.resolve<unknown>(undefined);
    let created = false;
    db.$transaction.mockImplementation(fn => {
      const result = serialized.then(() => fn(db.tx));
      serialized = result.catch(() => undefined);
      return result;
    });
    db.tx.adviserRequest.findFirst.mockImplementation(async () => created
      ? { status: "PENDING", adviserStatus: "PENDING", deanStatus: "PENDING" } : null);
    db.adviserRequest.create.mockImplementation(async () => { created = true; return { id: "req-1" }; });
    const results = await Promise.allSettled([
      service.createRequest("student-user", submission()), service.createRequest("student-user", submission()),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(db.adviserRequest.create).toHaveBeenCalledTimes(1);
    expect(db.tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it.each(["requestedAdviserId", "reason", "sourceDefenseScheduleId", "studentId"])("rejects changed signed-request %s at approval", async field => {
    db.tx.adviserRequest.findUnique.mockResolvedValue({ ...request(), [field]: "Changed" });
    await expect(service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "APPROVED" })).rejects.toThrow(/cannot be replaced/);
    expect(db.tx.adviserRequestOfficialRecord.create).not.toHaveBeenCalled();
    expect(db.tx.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it.each(["signatureData", "signedAt", "payload"])("rejects replaced signing evidence %s", async field => {
    const evidence = signedRequestEvidence(request() as never);
    db.tx.adviserRequestSignedState.findUnique.mockResolvedValue({ ...evidence,
      [field]: field === "signedAt" ? new Date() : field === "payload" ? { ...evidence.payload as object, studentName: "Changed" } : "Changed" });
    await expect(service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "APPROVED" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("approves from the exact signed values without consulting mutable profiles", async () => {
    db.student.findUnique.mockRejectedValue(new Error("Live profiles must not be loaded"));
    await service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "APPROVED" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const record = db.tx.adviserRequestOfficialRecord.create.mock.calls[0][0].data;
    expect(record.snapshot).toMatchObject({ ...REVIEW_CONTEXT, reason: request().reason,
      studentUserId: "student-user", formCode: "EARIST-QSF-GS-020", revision: "Rev. 00", effectiveDate: "06.20.25",
      adviserStatus: "CONFORMED", deanStatus: "APPROVED", deanReviewedById: "admin-user",
      printedDeanName: "", printedDeanSignature: null });
    expect(record.signatureData).toBe(STUDENT_SIGNATURE);
    expect(db.tx.adviserAssignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adviserId: "adv-user" }) });
    expect(db.student.findUnique).not.toHaveBeenCalled();
    expect(db.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.tx.adviserRequest.findUnique.mock.invocationCallOrder[0]);
  });

  it("leaves legacy unsigned requests without a fabricated official record or a new approval", async () => {
    db.tx.adviserRequestSignedState.findUnique.mockResolvedValue(null);
    await expect(service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "APPROVED" })).rejects.toThrow(/new signed request/);
    expect(db.tx.adviserAssignment.create).not.toHaveBeenCalled();
    expect(db.tx.adviserRequestOfficialRecord.create).not.toHaveBeenCalled();
  });

  it("rejects without creating an assignment or snapshot, including a legacy request", async () => {
    db.tx.adviserRequestSignedState.findUnique.mockResolvedValue(null);
    await service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "REJECTED" });
    expect(db.tx.adviserAssignment.create).not.toHaveBeenCalled();
    expect(db.tx.adviserRequestOfficialRecord.create).not.toHaveBeenCalled();
  });

  it.each(["snapshot", "assignment"])("rolls back approval, assignment, and snapshot when %s creation fails", async failure => {
    let committed = { approved: false, record: false, assignment: false };
    db.$transaction.mockImplementation(async fn => {
      const pending = { ...committed };
      db.tx.adviserRequest.updateMany.mockImplementation(async () => { pending.approved = true; return { count: 1 }; });
      db.tx.adviserRequestOfficialRecord.create.mockImplementation(async () => {
        pending.record = true;
        if (failure === "snapshot") throw new Error("Snapshot insert failed");
      });
      db.tx.adviserAssignment.create.mockImplementation(async () => { pending.assignment = true; throw new Error("Assignment insert failed"); });
      const result = await fn(db.tx);
      committed = pending;
      return result;
    });
    await expect(service.deanDecideAdviserRequest("admin-user", "req-1", { decision: "APPROVED" })).rejects.toThrow(/insert failed/);
    expect(committed).toEqual({ approved: false, record: false, assignment: false });
  });
});
