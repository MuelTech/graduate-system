import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  defenseSchedule: { findUnique: vi.fn(), update: vi.fn() },
  panelAssignment: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  adviserAssignment: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const notificationMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));
vi.mock("../../../src/services/notification.service", () => ({
  NotificationService: class {
    notifyDefenseCorrection = notificationMock;
  },
}));

import { DefenseScheduleCorrectionService } from "../../../src/services/defense-schedule-correction.service";
import { AppError } from "../../../src/utils/AppError";

type Assignment = {
  id: string;
  scheduleId: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  user: { firstName: string; lastName: string };
};

const at = new Date("2026-10-01T00:00:00.000Z");

function assignment(
  id: string,
  userId: string,
  role: string,
  isActive = true,
): Assignment {
  return {
    id,
    scheduleId: "sched-1",
    userId,
    role,
    isActive,
    createdAt: at,
    user: { firstName: userId, lastName: "Member" },
  };
}

function proposalMasters(overrides: { chair?: string; p1?: string; rap?: string; fac?: string } = {}) {
  return [
    assignment("pa-adviser", "adviser-1", "ADVISER"),
    assignment("pa-chair", overrides.chair ?? "chair-1", "CHAIRMAN"),
    assignment("pa-p1", overrides.p1 ?? "panel-1", "PANELIST"),
    assignment("pa-p2", "panel-2", "PANELIST"),
    assignment("pa-p3", "panel-3", "PANELIST"),
    assignment("pa-fac", overrides.fac ?? "fac-1", "FACILITATOR"),
    assignment("pa-rap", overrides.rap ?? "rap-1", "RAPPORTEUR"),
  ];
}

function titleMasters() {
  return [
    assignment("pa-chair", "chair-1", "CHAIRMAN"),
    assignment("pa-p1", "panel-1", "PANELIST"),
    assignment("pa-p2", "panel-2", "PANELIST"),
    assignment("pa-p3", "panel-3", "PANELIST"),
    assignment("pa-p4", "panel-4", "PANELIST"),
    assignment("pa-fac", "fac-1", "FACILITATOR"),
    assignment("pa-rap", "rap-1", "RAPPORTEUR"),
  ];
}

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "SCHEDULED",
    defenseDate: new Date("2026-11-10T00:00:00.000Z"),
    defenseTime: new Date("1970-01-01T09:00:00.000Z"),
    venueOrLink: "Room 201",
    manuscriptDocumentId: "doc-1",
    conclusion: null,
    thesis: {
      student: {
        id: "student-1",
        userId: "student-user-1",
        program: { programType: "MASTERS" },
      },
    },
    panelAssignments: proposalMasters(),
    ...overrides,
  };
}

function manual(roster: Assignment[]) {
  return roster
    .filter((row) => row.role !== "ADVISER")
    .map((row) => ({ userId: row.userId, role: row.role }));
}

function auditPayload(callIndex = 0) {
  const data = prismaMock.auditLog.create.mock.calls[callIndex][0].data;
  return {
    data,
    before: JSON.parse(data.oldValue),
    after: JSON.parse(data.newValue),
  };
}

describe("DEF-CORR-1 DefenseScheduleCorrectionService", () => {
  const service = new DefenseScheduleCorrectionService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
    );
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.defenseSchedule.update.mockResolvedValue({});
    prismaMock.panelAssignment.findMany.mockResolvedValue(proposalMasters());
    prismaMock.panelAssignment.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.panelAssignment.update.mockResolvedValue({});
    prismaMock.panelAssignment.create.mockResolvedValue({});
    prismaMock.adviserAssignment.findMany.mockResolvedValue([
      { id: "adv-asg-1", adviserId: "adviser-1", isActive: true },
    ]);
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
    notificationMock.mockResolvedValue(2);
  });

  it("rejects a missing schedule", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(null);
    await expect(
      service.correctSchedule("missing", "admin-1", {
        defenseDate: "2026-11-20",
        defenseTime: "10:30",
        venueOrLink: "Room 202",
        assignments: manual(proposalMasters()),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each([
    "IN_PROGRESS",
    "AWAITING_CONCLUSION",
    "CONCLUDED",
    "CANCELLED",
  ])("rejects correction while %s", async (sessionStatus) => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus }),
    );
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-20",
        defenseTime: "10:30",
        venueOrLink: "Room 202",
        assignments: manual(proposalMasters()),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.defenseSchedule.update).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("supports a date-only correction without changing the roster", async () => {
    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-20",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(proposalMasters()),
    });

    expect(prismaMock.defenseSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: {
        defenseDate: new Date("2026-11-20"),
        defenseTime: new Date("1970-01-01T09:00:00.000Z"),
        venueOrLink: "Room 201",
      },
    });
    expect(prismaMock.panelAssignment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.panelAssignment.create).not.toHaveBeenCalled();
    expect(prismaMock.panelAssignment.update).not.toHaveBeenCalled();
  });

  it("corrects time and venue", async () => {
    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "13:45",
      venueOrLink: "https://meet.example.test/defense",
      assignments: manual(proposalMasters()),
    });
    expect(prismaMock.defenseSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: {
        defenseDate: new Date("2026-11-10"),
        defenseTime: new Date("1970-01-01T13:45:00.000Z"),
        venueOrLink: "https://meet.example.test/defense",
      },
    });
  });

  it.each([
    ["Chairman", "pa-chair", "chair-2", "CHAIRMAN"],
    ["Panelist", "pa-p1", "panel-9", "PANELIST"],
    ["Rapporteur", "pa-rap", "rap-2", "RAPPORTEUR"],
    ["Facilitator", "pa-fac", "fac-2", "FACILITATOR"],
  ])("replaces the %s and deactivates the prior assignment", async (_label, oldId, newUserId, role) => {
    const roster = proposalMasters();
    const before = roster.find((row) => row.id === oldId)!;
    const desired = manual(roster.filter((row) => row.id !== oldId));
    desired.push({ userId: newUserId, role });
    const after = [
      ...roster.filter((row) => row.id !== oldId),
      assignment(`pa-${newUserId}`, newUserId, role),
    ];
    prismaMock.panelAssignment.findMany.mockResolvedValue(after);

    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: desired,
    });

    expect(prismaMock.panelAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        scheduleId: "sched-1",
        isActive: true,
        userId: { notIn: expect.arrayContaining([newUserId]) },
      },
      data: { isActive: false },
    });
    expect(prismaMock.panelAssignment.create).toHaveBeenCalledWith({
      data: {
        scheduleId: "sched-1",
        userId: newUserId,
        role,
        isActive: true,
      },
    });
    const { before: oldSnapshot, after: newSnapshot } = auditPayload();
    expect(oldSnapshot.committee).toContainEqual({
      assignmentId: before.id,
      userId: before.userId,
      displayName: `${before.userId} Member`,
      role: before.role,
    });
    expect(newSnapshot.committee).toContainEqual({
      assignmentId: `pa-${newUserId}`,
      userId: newUserId,
      displayName: `${newUserId} Member`,
      role,
    });
  });

  it("reactivates a previously inactive assignment for the same user", async () => {
    const inactive = assignment("pa-panel-9", "panel-9", "PANELIST", false);
    const schedule = scheduleRow({
      panelAssignments: [...proposalMasters(), inactive],
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(schedule);
    const desired = manual(
      proposalMasters().filter((row) => row.id !== "pa-p1"),
    );
    desired.push({ userId: "panel-9", role: "PANELIST" });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      ...proposalMasters().filter((row) => row.id !== "pa-p1"),
      assignment("pa-panel-9", "panel-9", "PANELIST", true),
    ]);

    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: desired,
    });

    expect(prismaMock.panelAssignment.update).toHaveBeenCalledWith({
      where: { id: "pa-panel-9" },
      data: { role: "PANELIST", isActive: true },
    });
    expect(prismaMock.panelAssignment.create).not.toHaveBeenCalled();
  });

  it("updates the role on the same active assignment without replacing it", async () => {
    const roster = proposalMasters();
    const desired = manual(roster).map((row) =>
      row.userId === "fac-1"
        ? { userId: row.userId, role: "RAPPORTEUR" }
        : row.userId === "rap-1"
          ? { userId: row.userId, role: "FACILITATOR" }
          : row,
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue(
      roster.map((row) =>
        row.userId === "fac-1"
          ? { ...row, role: "RAPPORTEUR" }
          : row.userId === "rap-1"
            ? { ...row, role: "FACILITATOR" }
            : row,
      ),
    );

    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: desired,
    });

    expect(prismaMock.panelAssignment.update).toHaveBeenCalledWith({
      where: { id: "pa-fac" },
      data: { role: "RAPPORTEUR", isActive: true },
    });
    expect(prismaMock.panelAssignment.update).toHaveBeenCalledWith({
      where: { id: "pa-rap" },
      data: { role: "FACILITATOR", isActive: true },
    });
    expect(prismaMock.panelAssignment.create).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied Adviser seat", async () => {
    const assignments = [
      ...manual(proposalMasters()),
      { userId: "adviser-1", role: "ADVISER" },
    ];
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-10",
        defenseTime: "09:00",
        venueOrLink: "Room 201",
        assignments,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.adviserAssignment.findMany).not.toHaveBeenCalled();
  });

  it("never adds an Adviser seat to Title Defense", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        panelAssignments: titleMasters(),
      }),
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue(titleMasters());

    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(titleMasters()),
    });

    expect(prismaMock.adviserAssignment.findMany).not.toHaveBeenCalled();
    const { after } = auditPayload();
    expect(after.committee.some((row: { role: string }) => row.role === "ADVISER")).toBe(false);
  });

  it("validates Master's Proposal/Final composition", async () => {
    const invalid = manual(proposalMasters()).filter(
      (row) => row.role !== "PANELIST",
    );
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-10",
        defenseTime: "09:00",
        venueOrLink: "Room 201",
        assignments: invalid,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.defenseSchedule.update).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("validates Doctoral composition", async () => {
    const roster = [
      assignment("pa-adviser", "adviser-1", "ADVISER"),
      assignment("pa-chair", "chair-1", "CHAIRMAN"),
      assignment("pa-p1", "panel-1", "PANELIST"),
      assignment("pa-p2", "panel-2", "PANELIST"),
      assignment("pa-p3", "panel-3", "PANELIST"),
      assignment("pa-p4", "panel-4", "PANELIST"),
      assignment("pa-fac", "fac-1", "FACILITATOR"),
      assignment("pa-rap", "rap-1", "RAPPORTEUR"),
    ];
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        thesis: {
          student: {
            id: "student-1",
            program: { programType: "DOCTORAL" },
          },
        },
        panelAssignments: roster,
      }),
    );
    prismaMock.panelAssignment.findMany.mockResolvedValue(roster);

    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-10",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(roster),
    });

    expect(prismaMock.defenseSchedule.update).toHaveBeenCalled();
  });

  it("does not mutate the exact manuscript, defense type, thesis identity, or schedule ID", async () => {
    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-20",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(proposalMasters()),
    });

    expect(prismaMock.defenseSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: {
        defenseDate: new Date("2026-11-20"),
        defenseTime: new Date("1970-01-01T09:00:00.000Z"),
        venueOrLink: "Room 201",
      },
    });
    const data = prismaMock.defenseSchedule.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("manuscriptDocumentId");
    expect(data).not.toHaveProperty("defenseType");
    expect(data).not.toHaveProperty("thesisId");
    expect(data).not.toHaveProperty("id");
  });

  it("writes one authenticated Admin correction audit with exact before/after snapshots", async () => {
    await service.correctSchedule("sched-1", "admin-actor", {
      defenseDate: "2026-11-20",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(proposalMasters()),
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const { data, before, after } = auditPayload();
    expect(data).toMatchObject({
      actorId: "admin-actor",
      actionType: "DEFENSE_SCHEDULE_CORRECTED",
      targetTable: "defense_schedules",
      targetId: "sched-1",
    });
    expect(before).toMatchObject({
      scheduleId: "sched-1",
      thesisId: "thesis-1",
      defenseType: "PROPOSAL_DEFENSE",
      schedule: {
        defenseDate: "2026-11-10T00:00:00.000Z",
        defenseTime: "1970-01-01T09:00:00.000Z",
        venueOrLink: "Room 201",
      },
    });
    expect(after).toMatchObject({
      scheduleId: "sched-1",
      thesisId: "thesis-1",
      defenseType: "PROPOSAL_DEFENSE",
      schedule: {
        defenseDate: "2026-11-20T00:00:00.000Z",
        defenseTime: "1970-01-01T09:00:00.000Z",
        venueOrLink: "Room 201",
      },
    });
    expect(before.committee).toHaveLength(7);
    expect(after.committee).toHaveLength(7);
  });

  it("rejects the whole correction when the audit write fails", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-20",
        defenseTime: "09:00",
        venueOrLink: "Room 201",
        assignments: manual(proposalMasters()),
      }),
    ).rejects.toThrow("audit unavailable");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(notificationMock).not.toHaveBeenCalled();
  });

  it("notifies after commit with the authoritative before/after snapshots", async () => {
    await service.correctSchedule("sched-1", "admin-1", {
      defenseDate: "2026-11-20",
      defenseTime: "09:00",
      venueOrLink: "Room 201",
      assignments: manual(proposalMasters()),
    });

    expect(notificationMock).toHaveBeenCalledWith({
      studentUserId: "student-user-1",
      before: expect.objectContaining({
        scheduleId: "sched-1",
        committee: expect.arrayContaining([
          expect.objectContaining({ userId: "chair-1", role: "CHAIRMAN" }),
        ]),
      }),
      after: expect.objectContaining({
        scheduleId: "sched-1",
        schedule: expect.objectContaining({
          defenseDate: "2026-11-20T00:00:00.000Z",
        }),
      }),
    });
  });

  it("keeps correction success when notification creation fails", async () => {
    notificationMock.mockRejectedValue(new Error("notification store down"));
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-20",
        defenseTime: "09:00",
        venueOrLink: "Room 201",
        assignments: manual(proposalMasters()),
      }),
    ).resolves.toMatchObject({ scheduleId: "sched-1" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not attempt notifications when correction authority rejects", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "IN_PROGRESS" }),
    );
    await expect(
      service.correctSchedule("sched-1", "admin-1", {
        defenseDate: "2026-11-20",
        defenseTime: "09:00",
        venueOrLink: "Room 201",
        assignments: manual(proposalMasters()),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(notificationMock).not.toHaveBeenCalled();
  });
});
