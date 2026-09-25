import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/AppError";

const prismaMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  defenseConclusion: { findFirst: vi.fn() },
  panelAssignment: { findUnique: vi.fn() },
  adviserAssignment: { findFirst: vi.fn(), create: vi.fn() },
  adviserRequest: { findFirst: vi.fn(), create: vi.fn() },
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
          // Valid ODP role but User.role is ADMIN — must be excluded.
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
          // Valid ODP role but no Panelist profile — must be excluded.
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

describe("AdviserRequestService (WP2 correction)", () => {
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

  it("excludes CHAIRMAN/PANELIST seat when User.role is not PANELIST", async () => {
    const result = await svc.listOdpCandidates("user-1");
    expect(result.candidates.map((c) => c.userId)).not.toContain("admin-seat");

    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "admin-seat" }),
    ).rejects.toThrow(/PANELIST user role/i);
  });

  it("excludes seat with no Panelist profile", async () => {
    const result = await svc.listOdpCandidates("user-1");
    expect(result.candidates.map((c) => c.userId)).not.toContain("no-profile");

    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "no-profile" }),
    ).rejects.toThrow(/Panelist profile/i);
  });

  it("excludes inactive Panelist profile and unavailable adviser", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      titleConclusion({
        schedule: {
          panelAssignments: [
            {
              role: "PANELIST",
              user: {
                id: "inactive-panel",
                firstName: "Ina",
                lastName: "Active",
                role: "PANELIST",
                isActive: true,
                panelist: panelistProfile({ isActive: false }),
              },
            },
            {
              role: "PANELIST",
              user: {
                id: "unavailable-panel",
                firstName: "Una",
                lastName: "Vailable",
                role: "PANELIST",
                isActive: true,
                panelist: panelistProfile({ isAvailableAsAdviser: false }),
              },
            },
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
          ],
        },
      }),
    );

    const result = await svc.listOdpCandidates("user-1");
    expect(result.candidates.map((c) => c.userId)).toEqual(["chair-user"]);

    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "inactive-panel" }),
    ).rejects.toThrow(/inactive/i);
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "unavailable-panel" }),
    ).rejects.toThrow(/not available as adviser/i);
  });

  it("rejects Facilitator and Rapporteur with explicit role errors", async () => {
    prismaMock.panelAssignment.findUnique
      .mockResolvedValueOnce({ role: "FACILITATOR" })
      .mockResolvedValueOnce({ role: "RAPPORTEUR" });

    // Use seats list path (preferred): createRequest uses ctx.seats first.
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "fac-user" }),
    ).rejects.toThrow(/FACILITATOR/i);
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "rap-user" }),
    ).rejects.toThrow(/RAPPORTEUR/i);
  });

  it("accepts valid Chairman/Panelist and stores GS-020 fields without AdviserAssignment", async () => {
    const created = await svc.createRequest("user-1", {
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
    expect(created).toBeTruthy();
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();

    await svc.createRequest("user-1", { requestedAdviserId: "panel-user" });
    expect(prismaMock.adviserRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedAdviserId: "panel-user",
        sourceDefenseScheduleId: "schedule-1",
        approvedById: null,
      }),
    });
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

    // Legacy REJECTED row with default PENDING statuses must not block.
    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      status: "REJECTED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    });
    // Query also filters status=PENDING, so a real DB would return null;
    // even if a row is returned, isOpenAdviserRequest treats it as closed.
    const afterReject = await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
    });
    expect(afterReject).toBeTruthy();

    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      status: "APPROVED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    });
    const afterApproved = await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
    });
    expect(afterApproved).toBeTruthy();
  });

  it("candidate endpoint returns only fully eligible ODP candidates with metadata", async () => {
    const result = await svc.listOdpCandidates("user-1");
    expect(result.sourceDefenseScheduleId).toBe("schedule-1");
    expect(result.candidates.map((c) => c.userId).sort()).toEqual([
      "chair-user",
      "panel-user",
    ]);
    const chair = result.candidates.find((c) => c.userId === "chair-user");
    expect(chair).toMatchObject({
      defenseRole: "CHAIRMAN",
      specialization: "Educational Management",
      officeAffiliation: "Graduate School",
      isAvailableAsAdviser: true,
    });
  });
});
