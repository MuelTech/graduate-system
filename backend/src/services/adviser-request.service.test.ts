import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/AppError";

const prismaMock = vi.hoisted(() => {
  const tx = {
    adviserRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    adviserAssignment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return {
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
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

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
    prismaMock.adviserRequest.updateMany.mockImplementation(async (args: any) => ({
      count: 1,
    }));
    prismaMock.adviserRequest.findUnique.mockImplementation(async (args: any) => ({
      id: args.where.id,
      requestedAdviserId: "adv-user",
      status: "PENDING",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
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

    expect(prismaMock.adviserRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        requestedAdviserId: "adv-user",
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      },
      data: expect.objectContaining({
        adviserStatus: "CONFORMED",
        adviserRemarks: "Happy to advise",
        adviserRespondedAt: expect.any(Date),
      }),
    });
    // Dean fields must not be written on CONFORME.
    const call = prismaMock.adviserRequest.updateMany.mock.calls[0]?.[0];
    expect(call?.data).not.toHaveProperty("deanStatus");
    expect(call?.data).not.toHaveProperty("deanReviewedById");
    expect(call?.data).not.toHaveProperty("deanReviewedAt");
    expect(call?.data).not.toHaveProperty("deanRemarks");
    expect(call?.data).not.toHaveProperty("approvedById");
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("DECLINED closes as REJECTED without writing Dean fields", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    await svc.respondAsAdviser("adv-user", "req-1", {
      decision: "DECLINED",
      remarks: "Unavailable",
    });

    expect(prismaMock.adviserRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        requestedAdviserId: "adv-user",
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      },
      data: {
        adviserStatus: "DECLINED",
        adviserRespondedAt: expect.any(Date),
        adviserRemarks: "Unavailable",
        status: "REJECTED",
      },
    });
    const call = prismaMock.adviserRequest.updateMany.mock.calls[0]?.[0];
    expect(call?.data).not.toHaveProperty("deanReviewedById");
    expect(call?.data).not.toHaveProperty("deanRemarks");
    expect(call?.data).not.toHaveProperty("approvedById");
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("conditional update count=0 returns 409 (stale/concurrent cannot overwrite)", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(inboxRow());
    prismaMock.adviserRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      svc.respondAsAdviser("adv-user", "req-1", { decision: "CONFORMED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      svc.respondAsAdviser("adv-user", "req-1", { decision: "DECLINED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
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

describe("AdviserRequestService (WP4 Dean decision)", () => {
  const svc = new AdviserRequestService();
  const tx = prismaMock.__tx;

  function conformedRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: "req-1",
      studentId: "student-1",
      requestedAdviserId: "adv-user",
      status: "PENDING",
      adviserStatus: "CONFORMED",
      deanStatus: "PENDING",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.adviserAssignment.create.mockClear();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prismaMock.adviserRequest.findUnique.mockResolvedValue(conformedRequest());
    tx.adviserRequest.findUnique.mockResolvedValue(conformedRequest());
    tx.adviserRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.adviserAssignment.findFirst.mockResolvedValue(null);
    tx.adviserAssignment.create.mockResolvedValue({ id: "asg-1" });
    tx.$queryRaw.mockResolvedValue([{ student_id: "student-1" }]);
  });

  it("Dean review list filters CONFORMED + Dean PENDING with metadata", async () => {
    prismaMock.adviserRequest.findMany.mockResolvedValue([
      {
        ...inboxRow({ adviserStatus: "CONFORMED" }),
        requestedAdviser: {
          id: "adv-user",
          firstName: "Ana",
          lastName: "Chair",
          email: "a@e",
          panelist: {
            specialization: "EdM",
            officeAffiliation: "GS",
          },
        },
        sourceDefenseSchedule: {
          id: "schedule-1",
          conclusion: {
            selectedTitle: { id: "title-1", titleText: "Official Title" },
          },
          panelAssignments: [{ userId: "adv-user", role: "CHAIRMAN" }],
        },
      },
    ]);

    const rows = await svc.listDeanReviewRequests();
    expect(prismaMock.adviserRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PENDING",
          adviserStatus: "CONFORMED",
          deanStatus: "PENDING",
        },
      }),
    );
    expect(rows[0]).toMatchObject({
      officialTitle: "Official Title",
      titleDefenseRole: "CHAIRMAN",
      requestedAdviser: {
        userId: "adv-user",
        name: "Ana Chair",
        specialization: "EdM",
        officeAffiliation: "GS",
      },
    });
  });

  it("APPROVE writes Dean audit fields and approvedById compatibility mirror", async () => {
    await svc.deanDecideAdviserRequest("dean-1", "req-1", {
      decision: "APPROVED",
      remarks: "Approved",
    });

    expect(tx.adviserRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
      data: expect.objectContaining({
        deanStatus: "APPROVED",
        deanReviewedById: "dean-1",
        deanReviewedAt: expect.any(Date),
        deanRemarks: "Approved",
        status: "APPROVED",
        approvedById: "dean-1",
      }),
    });
    expect(tx.adviserAssignment.create).toHaveBeenCalledWith({
      data: {
        studentId: "student-1",
        adviserId: "adv-user",
        assignedDate: expect.any(Date),
        isActive: true,
      },
    });
  });

  it("REJECT stores Dean audit fields, does NOT write approvedById, creates no assignment", async () => {
    await svc.deanDecideAdviserRequest("dean-1", "req-1", {
      decision: "REJECTED",
      remarks: "Not now",
    });

    expect(tx.adviserRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
      data: {
        deanStatus: "REJECTED",
        deanReviewedById: "dean-1",
        deanReviewedAt: expect.any(Date),
        deanRemarks: "Not now",
        status: "REJECTED",
      },
    });
    const call = tx.adviserRequest.updateMany.mock.calls[0]?.[0];
    expect(call?.data).not.toHaveProperty("approvedById");
    expect(tx.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("blocks APPROVE before CONFORME / after Decline / after Dean decided", async () => {
    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ adviserStatus: "PENDING" }),
    );
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ adviserStatus: "DECLINED", status: "REJECTED" }),
    );
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ deanStatus: "APPROVED", status: "APPROVED" }),
    );
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", { decision: "REJECTED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("blocks duplicate active AdviserAssignment after per-student lock", async () => {
    const order: string[] = [];
    tx.$queryRaw.mockImplementation(async () => {
      order.push("lock");
      return [{ student_id: "student-1" }];
    });
    tx.adviserAssignment.findFirst.mockImplementation(async () => {
      order.push("check");
      return { id: "existing" };
    });

    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(order).toEqual(["lock", "check"]);
    expect(tx.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("two different CONFORMED requests for the same Student cannot both create active assignments", async () => {
    // Request A approval: lock, no active, create.
    // Request B approval: lock (serialized), sees A's active assignment → 409.
    let activeCreated = false;
    tx.$queryRaw.mockResolvedValue([{ student_id: "student-1" }]);
    tx.adviserAssignment.findFirst.mockImplementation(async () =>
      activeCreated ? { id: "asg-from-A" } : null,
    );
    tx.adviserAssignment.create.mockImplementation(async () => {
      activeCreated = true;
      return { id: "asg-1", studentId: "student-1", isActive: true };
    });

    // Request A (different row id)
    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ id: "req-A" }),
    );
    tx.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ id: "req-A" }),
    );
    await svc.deanDecideAdviserRequest("dean-1", "req-A", {
      decision: "APPROVED",
    });

    // Request B for same student
    prismaMock.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ id: "req-B", requestedAdviserId: "other-adv" }),
    );
    tx.adviserRequest.findUnique.mockResolvedValue(
      conformedRequest({ id: "req-B", requestedAdviserId: "other-adv" }),
    );
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-B", { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.adviserAssignment.create).toHaveBeenCalledTimes(1);
  });

  it("stale concurrent Dean transition count=0 returns 409 and creates no assignment", async () => {
    tx.adviserRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", { decision: "APPROVED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("invalid Dean decision and missing request", async () => {
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "req-1", {
        decision: "MAYBE" as any,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    prismaMock.adviserRequest.findUnique.mockResolvedValue(null);
    await expect(
      svc.deanDecideAdviserRequest("dean-1", "missing", {
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("legacy approveAdviserRequest bypass is retired", async () => {
    const { ThesisRepository } = await import(
      "../repositories/thesis.repository"
    );
    const repo = new ThesisRepository();
    await expect(
      repo.approveAdviserRequest("req-1", "any-adviser", "admin"),
    ).rejects.toThrow(/retired|GS-020/i);
  });
});
