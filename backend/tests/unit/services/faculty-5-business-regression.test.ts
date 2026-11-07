import { beforeEach, expect, it, vi } from "vitest";
const repo = vi.hoisted(() => ({
  findWaiverContext: vi.fn(), updateWaiverStatus: vi.fn(), updateAlignmentStatus: vi.fn(), createAuditLog: vi.fn(),
  findStudentById: vi.fn(), updateCompExamStatus: vi.fn(), getStudentById: vi.fn(), updateComprehensiveExamStatus: vi.fn(),
}));
vi.mock("../../../src/services/cor.service", () => ({ CorService: class {} }));
vi.mock("../../../src/repositories/admin-applicant.repository", () => ({ AdminApplicantRepository: class {
  findWaiverContext = repo.findWaiverContext; updateWaiverStatus = repo.updateWaiverStatus;
  updateAlignmentStatus = repo.updateAlignmentStatus; createAuditLog = repo.createAuditLog;
} }));
vi.mock("../../../src/repositories/admin-student.repository", () => ({ AdminStudentRepository: class {
  findStudentById = repo.findStudentById; updateCompExamStatus = repo.updateCompExamStatus;
} }));
vi.mock("../../../src/services/student-thesis-journey.service", () => ({ StudentThesisJourneyService: class {} }));
vi.mock("../../../src/repositories/student.repository", () => ({ StudentRepository: class {
  getStudentById = repo.getStudentById; updateComprehensiveExamStatus = repo.updateComprehensiveExamStatus;
} }));
import { AdminApplicantService } from "../../../src/services/admin-applicant.service";
import { AdminStudentService } from "../../../src/services/admin-student.service";
import { StudentService } from "../../../src/services/student.service";
beforeEach(() => { vi.clearAllMocks(); repo.findWaiverContext.mockResolvedValue({ id: "target", bridgingWaiver: { id: "waiver", status: "PENDING" } }); });
it("retains Applicant waiver validate/reject transitions, notes and audit attribution", async () => {
  const service = new AdminApplicantService();
  expect(await service.validateWaiver("target", "actor")).toMatchObject({ alignmentStatus: "CLEARED" });
  expect(repo.updateWaiverStatus).toHaveBeenCalledWith("waiver", "VALIDATED", "actor");
  expect(repo.updateAlignmentStatus).toHaveBeenCalledWith("target", "CLEARED");
  expect(repo.createAuditLog).toHaveBeenCalledWith("actor", "waiver_validated", "target", expect.any(String));
  repo.updateAlignmentStatus.mockClear();
  expect(await service.rejectWaiver("target", "actor", { adminNotes: "Missing evidence" })).toMatchObject({ alignmentStatus: "PENDING_WAIVER" });
  expect(repo.updateWaiverStatus).toHaveBeenCalledWith("waiver", "REJECTED", "actor", "Missing evidence");
  expect(repo.updateAlignmentStatus).not.toHaveBeenCalled();
});
it("retains the existing waiver pending gate", async () => {
  repo.findWaiverContext.mockResolvedValue({ id: "target", bridgingWaiver: { id: "waiver", status: "VALIDATED" } });
  await expect(new AdminApplicantService().validateWaiver("target", "actor")).rejects.toMatchObject({ statusCode: 400 });
  expect(repo.updateWaiverStatus).not.toHaveBeenCalled();
});
it.each(["PENDING", "PASSED", "FAILED"] as const)("retains both comprehensive recording aliases' existing %s writes", async status => {
  repo.findStudentById.mockResolvedValue({ id: "target", compExamRecords: [] });
  repo.getStudentById.mockResolvedValue({ id: "target" });
  await new AdminStudentService().updateCompExamStatus("target", status, "actor");
  await new StudentService().updateCompExam("target", { status }, "actor");
  expect(repo.updateCompExamStatus).toHaveBeenCalledWith("target", status);
  expect(repo.updateComprehensiveExamStatus).toHaveBeenCalledWith("target", status);
});
it("retains the existing Admin comprehensive maximum-failure gate without repairing attempt history", async () => {
  repo.findStudentById.mockResolvedValue({ id: "target", compExamRecords: [{ status: "FAILED" }, { status: "FAILED" }] });
  await expect(new AdminStudentService().updateCompExamStatus("target", "FAILED", "actor")).rejects.toMatchObject({ statusCode: 400 });
  expect(repo.updateCompExamStatus).not.toHaveBeenCalled();
});
