import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  entranceExamApplication: { findFirst: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamEngineService } from "../../../src/services/exam-engine.service";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 29, 10, 0));
  db.student.findUnique.mockResolvedValue({ id: "student1" });
  db.entranceExamApplication.findFirst.mockResolvedValue({ id: "owned-latest-app" });
  db.entranceExamApplication.findUnique.mockResolvedValue({
    id: "owned-latest-app",
    slot: { examDate: new Date(2026, 9, 29), examTime: new Date(1970, 0, 1, 9, 0) },
  });
});
afterEach(() => vi.useRealTimers());

describe("media reuses existing Applicant question access", () => {
  it("derives the latest application from the authenticated User's Student identity", async () => {
    await new ExamEngineService().assertApplicantQuestionAccess("user1");
    expect(db.student.findUnique).toHaveBeenCalledWith({ where: { userId: "user1" } });
    expect(db.entranceExamApplication.findFirst).toHaveBeenCalledWith({ where: { studentId: "student1" }, orderBy: { createdAt: "desc" } });
    expect(db.entranceExamApplication.findUnique).toHaveBeenCalledWith({ where: { id: "owned-latest-app" }, include: { slot: true } });
  });

  it("rejects missing Student profiles and exam applications", async () => {
    db.student.findUnique.mockResolvedValueOnce(null);
    await expect(new ExamEngineService().assertApplicantQuestionAccess("other-user")).rejects.toThrow("Student profile not found.");
    expect(db.entranceExamApplication.findFirst).not.toHaveBeenCalled();
    db.entranceExamApplication.findFirst.mockResolvedValueOnce(null);
    await expect(new ExamEngineService().assertApplicantQuestionAccess("user1")).rejects.toThrow("Exam application not found.");
  });

  it.each([[8, 58], [12, 1]])("preserves rejection outside the existing 09:00–12:00 window at %i:%i", async (hour, minute) => {
    vi.setSystemTime(new Date(2026, 9, 29, hour, minute));
    await expect(new ExamEngineService().assertApplicantQuestionAccess("user1")).rejects.toThrow();
  });

  it("preserves the existing 60-second early grace and application-date fallback", async () => {
    vi.setSystemTime(new Date(2026, 9, 29, 8, 59));
    db.entranceExamApplication.findUnique.mockResolvedValueOnce({
      slot: null, examDate: new Date(2026, 9, 29), examTime: new Date(1970, 0, 1, 9, 0),
    });
    await expect(new ExamEngineService().assertApplicantQuestionAccess("user1")).resolves.toBeUndefined();
  });

  it("rejects absent authoritative schedule data", async () => {
    db.entranceExamApplication.findUnique.mockResolvedValueOnce({ slot: null });
    await expect(new ExamEngineService().assertApplicantQuestionAccess("user1")).rejects.toThrow("No scheduled exam found.");
  });
});
