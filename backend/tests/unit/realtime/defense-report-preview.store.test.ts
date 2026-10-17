import { describe, expect, it, vi } from "vitest";

import { createPrismaDefenseReportPreviewStore } from "../../../src/realtime/defense-report-preview.store";

function makeClient() {
  return {
    defenseSchedule: { findUnique: vi.fn() },
    panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  };
}

describe("Prisma defense report preview store", () => {
  it("reads the exact sender assignment role and latest report lifecycle state", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "IN_PROGRESS",
      panelAssignments: [{ role: "RAPPORTEUR" }],
      rapReports: [{ status: "DRAFT", frozenAt: null }],
    });
    const store = createPrismaDefenseReportPreviewStore(client as never);

    await expect(
      store.getReportPreviewSenderState("sched-1", "rapporteur-1"),
    ).resolves.toEqual({
      sessionStatus: "IN_PROGRESS",
      role: "RAPPORTEUR",
      rapStatus: "DRAFT",
      rapFrozenAt: null,
    });

    expect(client.defenseSchedule.findUnique).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      select: {
        sessionStatus: true,
        panelAssignments: {
          where: { userId: "rapporteur-1" },
          select: { role: true },
          take: 1,
        },
        rapReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, frozenAt: true },
        },
      },
    });
  });

  it("returns no report state before the first save", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "SCHEDULED",
      panelAssignments: [{ role: "RAPPORTEUR" }],
      rapReports: [],
    });
    const store = createPrismaDefenseReportPreviewStore(client as never);

    await expect(
      store.getReportPreviewSenderState("sched-1", "rapporteur-1"),
    ).resolves.toEqual({
      sessionStatus: "SCHEDULED",
      role: "RAPPORTEUR",
      rapStatus: null,
      rapFrozenAt: null,
    });
  });

  it("returns a null role for an unassigned user", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "IN_PROGRESS",
      panelAssignments: [],
      rapReports: [{ status: "DRAFT", frozenAt: null }],
    });
    const store = createPrismaDefenseReportPreviewStore(client as never);

    await expect(
      store.getReportPreviewSenderState("sched-1", "u-9"),
    ).resolves.toEqual({
      sessionStatus: "IN_PROGRESS",
      role: null,
      rapStatus: "DRAFT",
      rapFrozenAt: null,
    });
  });

  it("returns null when the schedule does not exist", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue(null);
    const store = createPrismaDefenseReportPreviewStore(client as never);

    await expect(
      store.getReportPreviewSenderState("sched-missing", "u-1"),
    ).resolves.toBeNull();
  });

  it("reuses the narrow exact-assignment membership reads", async () => {
    const client = makeClient();
    client.panelAssignment.findMany.mockResolvedValue([{ userId: "u-1" }]);
    const store = createPrismaDefenseReportPreviewStore(client as never);

    await expect(store.listAssignedUserIds("sched-1", ["u-1", "u-2"])).resolves.toEqual(
      new Set(["u-1"]),
    );
  });
});
