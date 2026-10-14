import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn() },
  thesisRecord: { findMany: vi.fn() },
  applicantBridgingWaiver: { count: vi.fn() },
  adviserRequest: { count: vi.fn() },
  defenseSchedule: { count: vi.fn(), findMany: vi.fn() },
  rapReport: { count: vi.fn() },
  auditLog: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DashboardRepository } from "../../../src/repositories/admin-dashboard.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardRepository authoritative metrics", () => {
  it("counts bridging waivers awaiting Admin validation", async () => {
    prismaMock.applicantBridgingWaiver.count.mockResolvedValue(3);
    const repo = new DashboardRepository();

    await expect(repo.getBridgingWaiversToReviewCount()).resolves.toBe(3);
    expect(prismaMock.applicantBridgingWaiver.count).toHaveBeenCalledWith({
      where: { status: "PENDING" },
    });
  });

  it("counts only adviser requests that reached the Dean-review stage", async () => {
    prismaMock.adviserRequest.count.mockResolvedValue(1);
    const repo = new DashboardRepository();

    await expect(repo.getAdviserRequestsForDeanReviewCount()).resolves.toBe(1);
    expect(prismaMock.adviserRequest.count).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
    });
  });

  it("counts defenses awaiting formal conclusion from the session state", async () => {
    prismaMock.defenseSchedule.count.mockResolvedValue(5);
    const repo = new DashboardRepository();

    await expect(repo.getDefensesAwaitingConclusionCount()).resolves.toBe(5);
    expect(prismaMock.defenseSchedule.count).toHaveBeenCalledWith({
      where: { sessionStatus: "AWAITING_CONCLUSION" },
    });
  });

  it("counts RAP reports still awaiting signatures", async () => {
    prismaMock.rapReport.count.mockResolvedValue(2);
    const repo = new DashboardRepository();

    await expect(repo.getRapReportsAwaitingSignaturesCount()).resolves.toBe(2);
    expect(prismaMock.rapReport.count).toHaveBeenCalledWith({
      where: { status: { in: ["FOR_SIGNATURE", "PARTIALLY_SIGNED"] } },
    });
  });

  it("reads thesis records newest-first per student for pipeline derivation", async () => {
    prismaMock.thesisRecord.findMany.mockResolvedValue([]);
    const repo = new DashboardRepository();

    await repo.getThesisRecordsForPipeline();

    expect(prismaMock.thesisRecord.findMany).toHaveBeenCalledWith({
      select: {
        studentId: true,
        stage: true,
        status: true,
        createdAt: true,
        id: true,
      },
      orderBy: [{ studentId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("preserves ThesisRecord.status so the pipeline can exclude failed attempts", async () => {
    prismaMock.thesisRecord.findMany.mockResolvedValue([
      {
        studentId: "s1",
        stage: "TITLE",
        status: "FAILED",
        createdAt: new Date("2026-01-01"),
        id: "s1-1",
      },
    ]);
    const repo = new DashboardRepository();

    await expect(repo.getThesisRecordsForPipeline()).resolves.toEqual([
      {
        studentId: "s1",
        stage: "TITLE",
        status: "FAILED",
        createdAt: new Date("2026-01-01"),
        id: "s1-1",
      },
    ]);
  });

  it("loads only ENROLLED students for the enrollment snapshot", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    const repo = new DashboardRepository();

    await repo.getEnrolledStudents();

    expect(prismaMock.student.findMany).toHaveBeenCalledWith({
      where: { admissionStatus: "ENROLLED" },
      select: { program: { select: { programName: true, programType: true } } },
    });
  });
});

describe("DashboardRepository.getUpcomingDefenses", () => {
  it("excludes cancelled/concluded sessions, filters to today-or-later, and orders by date then time", async () => {
    prismaMock.defenseSchedule.findMany.mockResolvedValue([]);
    const repo = new DashboardRepository();
    const now = new Date(2026, 5, 15, 10, 30); // local wall clock; UTC-anchored start of day

    await repo.getUpcomingDefenses(5, now);

    const call = prismaMock.defenseSchedule.findMany.mock.calls[0][0];
    expect(call.where.sessionStatus).toEqual({ notIn: ["CANCELLED", "CONCLUDED"] });
    expect(call.where.defenseDate.gte.getTime()).toBe(Date.UTC(2026, 5, 15));
    expect(call.orderBy).toEqual([{ defenseDate: "asc" }, { defenseTime: "asc" }]);
    expect(call.take).toBe(5);
  });

  it("maps session rows to wall-clock date/time strings without timezone shifting", async () => {
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        defenseDate: new Date(Date.UTC(2026, 5, 20)),
        defenseTime: new Date(Date.UTC(1970, 0, 1, 13, 30, 0)),
        venueOrLink: "Room 401",
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "SCHEDULED",
        thesis: {
          student: {
            studentNumber: "2026-GS-001",
            user: { firstName: "Juan", lastName: "Dela Cruz" },
            program: { programName: "MSIT" },
          },
        },
      },
    ]);
    const repo = new DashboardRepository();

    const rows = await repo.getUpcomingDefenses(5, new Date(2026, 5, 15));

    expect(rows).toEqual([
      {
        scheduleId: "sched-1",
        studentName: "Juan Dela Cruz",
        studentNumber: "2026-GS-001",
        programName: "MSIT",
        defenseType: "TITLE_DEFENSE",
        defenseDate: "2026-06-20",
        defenseTime: "13:30",
        venueOrLink: "Room 401",
        sessionStatus: "SCHEDULED",
      },
    ]);
  });
});
