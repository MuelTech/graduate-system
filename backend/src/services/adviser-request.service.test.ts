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
            isActive: true,
            panelist: {
              isActive: true,
              isAvailableAsAdviser: true,
              specialization: "Educational Management",
              officeAffiliation: "Graduate School",
              isExternal: false,
            },
          },
        },
        {
          role: "PANELIST",
          user: {
            id: "panel-user",
            firstName: "Ben",
            lastName: "Panel",
            isActive: true,
            panelist: {
              isActive: true,
              isAvailableAsAdviser: true,
              specialization: "Research",
              officeAffiliation: "CAS",
              isExternal: true,
            },
          },
        },
        {
          role: "FACILITATOR",
          user: {
            id: "fac-user",
            firstName: "Cara",
            lastName: "Fac",
            isActive: true,
            panelist: null,
          },
        },
        {
          role: "RAPPORTEUR",
          user: {
            id: "rap-user",
            firstName: "Dan",
            lastName: "Rap",
            isActive: true,
            panelist: null,
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("AdviserRequestService (WP2)", () => {
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
  });

  it("rejects when there is no formal passed Title Defense conclusion", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(null);
    await expect(svc.createRequest("user-1", { requestedAdviserId: "x" })).rejects.toThrow(
      /formally PASSED Title Defense/i,
    );
  });

  it("rejects when Title is APPROVED but no formal PASSED conclusion", async () => {
    // No DefenseConclusion with outcome PASSED — application APPROVED alone is not enough.
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(null);
    await expect(
      svc.listOdpCandidates("user-1"),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects when passed conclusion has no selectedTitleId", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(
      titleConclusion({ selectedTitleId: null, selectedTitle: null }),
    );
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "chair-user" }),
    ).rejects.toThrow(/official selected title/i);
  });

  it("rejects candidate outside the source Title Defense schedule", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "outsider" }),
    ).rejects.toThrow(/eligible member of your passed Title Defense ODP/i);
  });

  it("rejects Facilitator and Rapporteur seats", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      role: "FACILITATOR",
    });
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "fac-user" }),
    ).rejects.toThrow(/FACILITATOR/i);

    prismaMock.panelAssignment.findUnique.mockResolvedValue({
      role: "RAPPORTEUR",
    });
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "rap-user" }),
    ).rejects.toThrow(/RAPPORTEUR/i);
  });

  it("accepts valid Chairman and Panelist and stores GS-020 fields", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());

    const created = await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
      reason: "Please advise",
    });
    expect(prismaMock.adviserRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "student-1",
        requestedAdviserId: "chair-user",
        reason: "Please advise",
        sourceDefenseScheduleId: "schedule-1",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
        approvedById: null,
        status: "PENDING",
      }),
    });
    expect(created).toBeTruthy();

    await svc.createRequest("user-1", { requestedAdviserId: "panel-user" });
    expect(prismaMock.adviserRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedAdviserId: "panel-user",
        sourceDefenseScheduleId: "schedule-1",
        approvedById: null,
      }),
    });
  });

  it("does not create AdviserAssignment on request", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    await svc.createRequest("user-1", { requestedAdviserId: "chair-user" });
    expect(prismaMock.adviserAssignment.create).not.toHaveBeenCalled();
  });

  it("blocks duplicate while Adviser response or Dean review is pending", async () => {
    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    });
    await expect(
      svc.createRequest("user-1", { requestedAdviserId: "chair-user" }),
    ).rejects.toThrow(/already waiting/i);
  });

  it("permits retry after Adviser DECLINED", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    prismaMock.adviserRequest.findFirst
      .mockResolvedValueOnce({ adviserStatus: "DECLINED", deanStatus: "PENDING" })
      .mockResolvedValueOnce(null);
    // First findFirst for open check is DECLINED → not open → proceeds
    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      adviserStatus: "DECLINED",
      deanStatus: "PENDING",
    });
    const created = await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
    });
    expect(created).toBeTruthy();
  });

  it("permits retry after Dean REJECTED", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    prismaMock.adviserRequest.findFirst.mockResolvedValue({
      adviserStatus: "CONFORMED",
      deanStatus: "REJECTED",
    });
    const created = await svc.createRequest("user-1", {
      requestedAdviserId: "chair-user",
    });
    expect(created).toBeTruthy();
  });

  it("candidate endpoint returns only eligible ODP candidates with metadata", async () => {
    prismaMock.defenseConclusion.findFirst.mockResolvedValue(titleConclusion());
    const result = await svc.listOdpCandidates("user-1");
    expect(result.sourceDefenseScheduleId).toBe("schedule-1");
    expect(result.selectedTitle.titleText).toBe("Official Title");
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
