import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const repo = vi.hoisted(() => ({ getLatestResult: vi.fn(), getApplicationDetailsForEmail: vi.fn() }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../../../src/repositories/exam.repository", () => ({ ExamRepository: class {
  getLatestResult = repo.getLatestResult;
  getApplicationDetailsForEmail = repo.getApplicationDetailsForEmail;
} }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: { sendTemplateEmail: sendEmail } }));
import { ExamService } from "../../../src/services/exam.service";

const service = new ExamService();
function record(status = "TAKEN", scoreStatus: string | null = "PENDING") {
  return { id: "exact-app", status,
    score: scoreStatus === null ? null : { status: scoreStatus, multipleChoiceScore: new Prisma.Decimal(63), essayScore: null as Prisma.Decimal | null, totalScore: null as Prisma.Decimal | null },
    student: { user: { email: "authoritative@example.invalid", firstName: "Synthetic" } },
    program: { examMcqTotal: 72, examEssayTotal: 30, examPassingScore: 76 },
    slot: { examDate: new Date("2026-11-02T00:00:00Z") },
  };
}
beforeEach(() => vi.resetAllMocks());

describe("B0B result finality", () => {
  it.each([null, { ...record(), score: null }])("returns not available for missing results %#", async app => {
    repo.getLatestResult.mockResolvedValue(app);
    await expect(service.getExamResult("jwt-user")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.getLatestResult).toHaveBeenCalledWith("jwt-user");
  });

  const combinations = ["PENDING", "APPROVED", "TAKEN", "APPEALED", "DISQUALIFIED", "PASSED", "FAILED"]
    .flatMap(status => [null, "PENDING", "PASSED", "FAILED"].map(scoreStatus => ({ status, scoreStatus })))
    .filter(({ status, scoreStatus }) => !(["PASSED", "FAILED"].includes(status) && status === scoreStatus));

  it.each(combinations)("contains application $status / score $scoreStatus before result publication or email", async ({ status, scoreStatus }) => {
    const app = record(status, scoreStatus);
    repo.getLatestResult.mockResolvedValue(app);
    repo.getApplicationDetailsForEmail.mockResolvedValue(app);
    await expect(service.getExamResult("jwt-user")).rejects.toMatchObject({ statusCode: scoreStatus === null ? 404 : 409 });
    await expect(service.confirmResultAndEmail("exact-app")).rejects.toMatchObject({ statusCode: 409 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each(["PASSED", "FAILED"])("preserves persisted %s scores without recalculating the result", async status => {
    const app = record(status, status);
    app.score = { ...app.score!, essayScore: new Prisma.Decimal("17.5"), totalScore: new Prisma.Decimal("80.5") };
    repo.getLatestResult.mockResolvedValue(app);
    expect(await service.getExamResult("jwt-user")).toEqual({ status: status.toLowerCase(), mcqScore: 63, mcqTotal: 72, essayScore: 17.5, essayTotal: 30, totalScore: 80.5, totalPossible: 102, passingScore: 76, examDate: app.slot.examDate });
    // Even an existing FAILED score above this read's threshold stays FAILED.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not coerce pending null grades into a completed zero-score DTO", async () => {
    repo.getLatestResult.mockResolvedValue(record());
    await expect(service.getExamResult("jwt-user")).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("awaiting evaluation") });
  });

  it("rejects a missing email application before queueing", async () => {
    repo.getApplicationDetailsForEmail.mockResolvedValue(null);
    await expect(service.confirmResultAndEmail("missing")).rejects.toMatchObject({ statusCode: 404 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([["PASSED", "ecat_result_pass"], ["FAILED", "ecat_result_fail"]])("queues only the authoritative template for %s", async (status, template) => {
    repo.getApplicationDetailsForEmail.mockResolvedValue(record(status, status));
    await expect(service.confirmResultAndEmail("exact-app")).resolves.toMatchObject({ success: true, message: expect.stringContaining("queue") });
    expect(repo.getApplicationDetailsForEmail).toHaveBeenCalledWith("exact-app");
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith("authoritative@example.invalid", template, { student_name: "Synthetic", portal_link: process.env.FRONTEND_URL || "http://localhost:3000" });
  });

  it("propagates queue failure instead of returning success", async () => {
    repo.getApplicationDetailsForEmail.mockResolvedValue(record("PASSED", "PASSED"));
    sendEmail.mockRejectedValue(new Error("Queue unavailable"));
    await expect(service.confirmResultAndEmail("exact-app")).rejects.toThrow("Queue unavailable");
  });
});
