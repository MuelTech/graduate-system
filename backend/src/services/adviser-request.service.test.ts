import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/AppError";

const prismaMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  defenseConclusion: { findFirst: vi.fn() },
  panelAssignment: { findUnique: vi.fn() },
  adviserAssignment: { findFirst: vi.fn(), create: vi.fn() },
  adviserRequest: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../config/database", () => ({
  default: prismaMock,
}));

import { AdviserRequestService } from "./adviser-request.service";

function panelistProfile(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    isAvailableAsAdviser: true,
    specialization: "Educational Management",
    officeAffiliation: "Graduate School",
    isExternal: false,
    ...overrides,
  };
}

function titleConclusion(overrides: Record<string, unknown> = {}) {
  return {
    id: "conclusion-1",
    scheduleId: "schedule-1",
    selectedTitleId: "title-1",
    selectedTitle: { id: "title-1", titleText: "Official Title" },
    schedule: {
      panelAssignments: [
        {
          role: "CHAIRMAN",
          user: {
            id: "chair-user",
            firstName: "Ana",
            lastName: "Chair",
            role: "PANELIST",
            isActive: true,
            panelist: panelistProfile(),
          },
        },
        {
          role: "PANELIST",
          user: {
            id: "panel-user",
            firstName: "Ben",
            lastName: "Panel",
            role: "PANELIST",
            isActive: true,
            panelist: panelistProfile({
              specialization: "Research",
              officeAffiliation: "CAS",
              isExternal: true,
            }),
          },
        },
        {
          role: "FACILITATOR",
          user: {
            id: "fac-user",
            firstName: "Cara",
            lastName: "Fac",
            role: "PANELIST",
            isActive: true,
            panelist: panelistProfile(),
          },
        },
        {
          role: "RAPPORTEUR",
          user: {
            id: "rap-user",
            firstName: "Dan",
            lastName: "Rap",
            role: "PANELIST",
            isActive: true,
            panelist: panelistProfile(),
          },
        },
        {
          role: "PANELIST",
          user: {
            id: "admin-seat",
            firstName: "Eve",
            lastName: "Admin",
            role: "ADMIN",
            isActive: true,
            panelist: panelistProfile(),
          },
        },
        {
          role: "CHAIRMAN",
          user: {
            id: "no-profile",
            firstName: "Fay",
            lastName: "NoProfile",
            role: "PANELIST",
            isActive: true,
            panelist: null,
          },
        },
      ],
    },
    ...overrides,
  };
}

function inboxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    requestedAdviserId: "adv-user",
    reason: "Please advise",
    requestDate: new Date("2026-09-25"),
    status: "PENDING",
    adviserStatus: "PENDING",
    adviserRespondedAt: null,
    adviserRemarks: null,
    deanStatus: "PENDING",
    deanReviewedAt: null,
    deanRemarks: null,
    sourceDefenseScheduleId: "schedule-1",
    student: {
      id: "student-1",
      studentNumber: "2026-001",
      user: {
        id: "student-user",
        firstName: "Sam",
        lastName: "Student",
        email: "s@e",
      },
      program: { programName: "MIT" },
    },
    requestedAdviser: {
      id: "adv-user",
      firstName: "Ana",
      lastName: "Chair",
      email: "a@e",
    },
    sourceDefenseSchedule: {
      id: "schedule-1",
      conclusion: {
        id: "conclusion-1",
        selectedTitle: { id: "title-1", titleText: "Official Title" },
      },
      panelAssignments: [{ role: "CHAIRMAN" }],
    },
    ...overrides,
  };
}

describe("AdviserRequestService (WP2 candidates/request)", () => {
  const svc = new AdviserRequestService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      userId: "user-1",
    });
    prismaMock.adviserAssignment.findFirst.mockResolvedValue(null);
    prismaMock.adviserRequest.findFirst.mockResolvedValue(null);
    prismaMock.adviserRequest.create.mockImplementation(async (args: any) => ({
      id: "req-1",
      ...args.data,
    }));
    prismaMock.panelAssignment.findUnique.mockResolvedValue(null);
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
  });

  it("rejects when there is no formal passed Title Defense conclusion", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(null);
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "x" }),
    ).rejects.toThrow(/formally PASSED Title Defense/i);
  });

  it("rejects when passed conclusion has no selectedTitleId", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      titleConclusion({ selectedTitleId: null, selectedTitle: null }),
    );
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "chair-user" }),
    ).rejects.toThrow(/official selected title/i);
  });

  it("excludes seats that are not real PANELIST accounts", async () => {
    const result = await svc.listOdpCandidates("user-1");
    expect(result.candidates.map((c) => c.userId)).not.toContain("admin-seat");
    expect(result.candidates.map((c) => c.userId)).not.toContain("no-profile");

    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "admin-seat" }),
    ).rejects.toThrow(/PANELIST user role/i);
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "no-profile" }),
    ).rejects.toThrow(/Panelist profile/i);
  });

  it("accepts valid Chairman/Panelist and stores GS-020 fields without AdviserAssignment", async () => {
    await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
      reason: "Please advise",
    });
    expect(prismaMock.adviserRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "student-1",
        requestedAdviserId: "chair-user",
        sourceDefenseScheduleId: "schedule-1",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
        approvedById: null,
        status: "PENDING",
      }),
    });
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("blocks duplicate open request and allows retry after closed legacy statuses", async () => {
    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      status: "PENDING",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    });
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "chair-user" }),
    ).rejects.toThrow(/already waiting/i);

    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      status: "REJECTED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    });
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "chair-user" }),
    ).resolves.toBeTruthy();
  });
});

describe("AdviserRequestService (WP3 adviser response)", () => {
  const svc = new AdviserRequestService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.adviserAssignment.create.mockClear();
    prismaMock.adviserRequest.update.mockImplementation(async (args: any) => ({
      id: args.where.id,
      ...args.data,
    }));
  });

  it("returns own requests with student/program/title/role metadata", async () => {
    prismaMock.adviserRequest.findMany.mockResolvedValue([
      inboxRow(),
      inboxRow({
        id: "req-2",
        adviserStatus: "CONFORMED",
        adviserRemarks: "ok",
      }),
    ]);

    const rows = await svc.listMyAdviserRequests("adv-user");
    expect(prismaMock.adviserRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestedAdviserId: "adv-user" },
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      student: {
        name: "Sam Student",
        studentNumber: "2026-001",
        program: "MIT",
      },
      officialTitle: "Official Title",
      titleDefenseRole: "CHAIRMAN",
      sourceDefenseScheduleId: "schedule-1",
    });
  });

  it("scopes inbox by requestedAdviserId only", async () => {
    prismaMock.adviserRequest.findMany.mockResolvedValue([]);
    await svc.listMyAdviserRequests("other-adv");
    expect(prismaMock.adviserRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestedAdviserId: "other-adv" },
      }),
    );
  });

  it("CONFORMED keeps deanStatus/status PENDING and creates no AdviserAssignment", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    await svc.respondAsAdviser("adv-user", "req-1", {
      decision: "CONFORMED",
      remarks: "Happy to advise",
    });

    expect(prismaMock.adviserRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: expect.objectContaining({
        adviserStatus: "CONFORMED",
        adviserRemarks: "Happy to advise",
        deanStatus: "PENDING",
        status: "PENDING",
        adviserRespondedAt: expect.any(Date),
      }),
    });
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("DECLINED closes as REJECTED without writing Dean fields", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    await svc.respondAsAdviser("adv-user", "req-1", {
      decision: "DECLINED",
      remarks: "Unavailable",
    });

    expect(prismaMock.adviserRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: {
        adviserStatus: "DECLINED",
        adviserRespondedAt: expect.any(Date),
        adviserRemarks: "Unavailable",
        status: "REJECTED",
      },
    });
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("another adviser cannot respond (403)", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    await expect(
      svc.respondAsAdviser("other-adv", "req-1", { decision: "CONFORMED" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects repeat responses and Dean-finalized requests", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      inboxRow({ adviserStatus: "CONFORMED" }),
    );
    await expect(
      svc.respondAsAdviser("adv-user", "req-1", { decision: "DECLINED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      inboxRow({ adviserStatus: "DECLINED" }),
    );
    await expect(
      svc.respondAsAdviser("adv-user", "req-1", { decision: "CONFORMED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      inboxRow({ adviserStatus: "CONFORMED", deanStatus: "APPROVED" }),
    );
    await expect(
      svc.respondAsAdviser("adv-user", "req-1", { decision: "DECLINED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects invalid decision and missing request", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    await expect(
      svc.respondAsAdviser("adv-user", "req-1", {
        decision: "MAYBE" as any,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(null);
    await expect(
      svc.respondAsAdviser("adv-user", "missing", { decision: "CONFORMED" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
