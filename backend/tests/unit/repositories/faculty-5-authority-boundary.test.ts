import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ actor: null as any, transaction: null as any }));
const database = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: any) => fn(state.transaction)),
  student: { findUnique: vi.fn() }, corUpload: { findUnique: vi.fn() },
  applicantBridgingWaiver: { update: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: database }));
import { CorRepository } from "../../../src/repositories/cor.repository";
import { WaiverRepository } from "../../../src/repositories/waiver.repository";
import { AdminApplicantRepository } from "../../../src/repositories/admin-applicant.repository";
import { AdmissionStudentAuthorization } from "../../../src/access/admission-student-authorization";

const access = new AdmissionStudentAuthorization(true, async () => state.actor);
const cor = new CorRepository(access);
const waiver = new WaiverRepository(access);
const data = { studentNumber: "S1", firstName: "A", lastName: "B", email: "a@b.test", programId: "program", verificationMethod: "ADMIN_MANUAL" };
function grant(keys: string[]) {
  state.actor = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false,
    panelist: null, administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })) };
}
beforeEach(() => {
  vi.clearAllMocks(); grant(["cor.verify", "waivers.manage"]);
  state.transaction = {
    $queryRaw: vi.fn(async () => [{ id: 1 }]),
    user: { findUnique: vi.fn(async ({ where }: any) => where.id === "actor" ? state.actor : { id: "applicant-user", role: "APPLICANT" }), updateMany: vi.fn(async () => ({ count: 1 })) },
    student: { findUnique: vi.fn(async () => ({ id: "target", admissionStatus: "APPLICANT" })), updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn() },
    corUpload: { findFirst: vi.fn(async () => ({ id: "upload" })), updateMany: vi.fn(async () => ({ count: 1 })) },
    corRecord: { create: vi.fn(async () => ({ id: "record" })) },
    entranceExamApplication: { findFirst: vi.fn(async () => ({ id: "passed" })) },
    program: { findUnique: vi.fn(async () => ({ id: "program" })) },
    auditLog: { create: vi.fn() },
    applicantBridgingWaiver: { update: vi.fn(async () => ({ id: "waiver", studentId: "target" })) },
  };
});
const operations = [
  ["COR verify/promote", () => cor.verifyAndPromote("upload", "target", "applicant-user", data, "actor")],
  ["COR reject", () => cor.rejectUpload("upload", { studentId: "target", reason: "No", adminId: "actor" })],
  ["canonical waiver validate", () => waiver.validateWaiver("waiver", "actor")],
] as const;
describe("FACULTY-5 existing authoritative transactions", () => {
  it.each(operations)("%s reads the actor behind the shared fence before target operations", async (_name, operation) => {
    await operation();
    const tx = state.transaction;
    const firstSql = tx.$queryRaw.mock.calls[0][0].join("?");
    expect(firstSql).toContain("administrator_access_lock");
    expect(tx.user.findUnique.mock.calls[0][0].where).toEqual({ id: "actor" });
    expect(tx.user.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      Math.min(...[tx.corUpload.findFirst, tx.applicantBridgingWaiver.update].flatMap(fn => fn.mock.invocationCallOrder)),
    );
  });
  it.each(operations)("%s rejects permission loss after the prior service check without target writes", async (_name, operation) => {
    await access.assert("actor", "cor.verify");
    state.transaction.$queryRaw.mockImplementationOnce(async () => { grant([]); return [{ id: 1 }]; });
    await expect(operation()).rejects.toMatchObject({ statusCode: 403 });
    const tx = state.transaction;
    for (const fn of [tx.corUpload.updateMany, tx.student.updateMany, tx.user.updateMany,
      tx.corRecord.create, tx.auditLog.create, tx.applicantBridgingWaiver.update]) expect(fn).not.toHaveBeenCalled();
  });
  it("keeps the promotion credential update limited to the accepted role/identity fields", async () => {
    await cor.verifyAndPromote("upload", "target", "applicant-user", data, "actor");
    const write = state.transaction.user.updateMany.mock.calls[0][0];
    expect(write.data).toEqual({ role: "STUDENT", firstName: "A", lastName: "B", email: "a@b.test" });
    expect(write.data).not.toHaveProperty("passwordHash"); expect(write.data).not.toHaveProperty("mustChangePassword");
  });
  it("preserves canonical waiver validation and rejection fields", async () => {
    await waiver.validateWaiver("waiver", "actor");
    expect(state.transaction.applicantBridgingWaiver.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "VALIDATED", validatedById: "actor" }) }));
    expect(state.transaction.student.update).toHaveBeenCalledWith({ where: { id: "target" }, data: { alignmentStatus: "CLEARED" } });
    await waiver.rejectWaiver("waiver", "actor", "No");
    expect(database.applicantBridgingWaiver.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", adminNotes: "No", validatedById: "actor" }) }));
    grant(["waivers.view"]); database.applicantBridgingWaiver.update.mockClear();
    await expect(waiver.rejectWaiver("waiver", "actor", "No")).rejects.toMatchObject({ statusCode: 403 });
    expect(database.applicantBridgingWaiver.update).not.toHaveBeenCalled();
  });
  it("selects only exact target operation fields, excluding the full Applicant projection and credentials", async () => {
    const repo = new AdminApplicantRepository();
    await repo.findAdmissionContext("target");
    expect(database.student.findUnique).toHaveBeenLastCalledWith({ where: { id: "target" }, select: { id: true, admissionStatus: true, studentNumber: true } });
    await repo.findWaiverContext("target");
    expect(database.student.findUnique).toHaveBeenLastCalledWith({ where: { id: "target" }, select: { id: true, bridgingWaiver: { select: { id: true, status: true } } } });
    await cor.getUploadById("upload");
    expect(database.corUpload.findUnique).toHaveBeenCalledWith({ where: { id: "upload" }, select: {
      id: true, status: true, studentId: true, student: { select: { id: true, userId: true, admissionStatus: true, user: { select: { role: true } } } },
    } });
  });
});
