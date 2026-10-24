import { describe, expect, it, vi } from "vitest";

import { createPrismaDefenseRealtimeStore } from "../../../src/realtime/defense-realtime.store";

function makeClient() {
  return {
    defenseSchedule: { findUnique: vi.fn() },
    panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  };
}

describe("Prisma defense realtime authorization store", () => {
  it("reads only the exact schedule session status", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "IN_PROGRESS",
    });
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(store.getSessionStatus("sched-1")).resolves.toBe("IN_PROGRESS");
    expect(client.defenseSchedule.findUnique).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      select: { sessionStatus: true },
    });
  });

  it("returns null when the schedule does not exist", async () => {
    const client = makeClient();
    client.defenseSchedule.findUnique.mockResolvedValue(null);
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(store.getSessionStatus("sched-missing")).resolves.toBeNull();
  });

  it("checks the exact current schedule + user assignment", async () => {
    const client = makeClient();
    client.panelAssignment.findFirst.mockResolvedValue({ id: "pa-1" });
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(store.hasPanelAssignment("sched-1", "u-1")).resolves.toBe(true);
    expect(client.panelAssignment.findFirst).toHaveBeenCalledWith({
      where: { scheduleId: "sched-1", userId: "u-1", isActive: true },
      select: { id: true },
    });
  });

  it("returns false when the user has no exact assignment", async () => {
    const client = makeClient();
    client.panelAssignment.findFirst.mockResolvedValue(null);
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(store.hasPanelAssignment("sched-1", "u-2")).resolves.toBe(
      false,
    );
  });

  it("returns only currently assigned userIds for a room revalidation", async () => {
    const client = makeClient();
    client.panelAssignment.findMany.mockResolvedValue([
      { userId: "u-1" },
      { userId: "u-3" },
    ]);
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(
      store.listAssignedUserIds("sched-1", ["u-1", "u-2", "u-3"]),
    ).resolves.toEqual(new Set(["u-1", "u-3"]));
    expect(client.panelAssignment.findMany).toHaveBeenCalledWith({
      where: {
        scheduleId: "sched-1",
        userId: { in: ["u-1", "u-2", "u-3"] },
        isActive: true,
      },
      select: { userId: true },
    });
  });

  it("does not query when there are no connected userIds", async () => {
    const client = makeClient();
    const store = createPrismaDefenseRealtimeStore(client as never);

    await expect(store.listAssignedUserIds("sched-1", [])).resolves.toEqual(
      new Set(),
    );
    expect(client.panelAssignment.findMany).not.toHaveBeenCalled();
  });
});
