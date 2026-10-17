import { describe, expect, it, vi } from "vitest";

import {
  authorizeDefenseRoomJoin,
  resolveDefenseDeliveryAuthorization,
  type DefenseRealtimeAuthorizationStore,
} from "../../../src/realtime/defense-realtime.authorization";
import type { DefenseRealtimeEventName } from "../../../src/realtime/defense-realtime.types";

function makeStore(
  overrides: Partial<DefenseRealtimeAuthorizationStore> = {},
): DefenseRealtimeAuthorizationStore {
  return {
    getSessionStatus: vi.fn(async () => "SCHEDULED"),
    hasPanelAssignment: vi.fn(async () => true),
    listAssignedUserIds: vi.fn(async () => new Set(["u-1"])),
    ...overrides,
  };
}

describe("authorizeDefenseRoomJoin", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"])(
    "allows an assigned user while the session is %s",
    async (status) => {
      const store = makeStore({ getSessionStatus: vi.fn(async () => status) });

      await expect(
        authorizeDefenseRoomJoin(store, "sched-1", "u-1"),
      ).resolves.toEqual({ ok: true, room: "defense:sched-1" });
      expect(store.hasPanelAssignment).toHaveBeenCalledWith("sched-1", "u-1");
    },
  );

  it("denies an unassigned user even when the schedule is active", async () => {
    const store = makeStore({ hasPanelAssignment: vi.fn(async () => false) });

    await expect(
      authorizeDefenseRoomJoin(store, "sched-1", "u-2"),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it.each(["CONCLUDED", "CANCELLED", "UNSCHEDULED"])(
    "denies a %s schedule without exposing details",
    async (status) => {
      const store = makeStore({ getSessionStatus: vi.fn(async () => status) });

      await expect(
        authorizeDefenseRoomJoin(store, "sched-1", "u-1"),
      ).resolves.toEqual({ ok: false, code: "NOT_ACTIVE" });
    },
  );

  it("returns NOT_FOUND for a missing schedule", async () => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => null) });

    await expect(
      authorizeDefenseRoomJoin(store, "sched-missing", "u-1"),
    ).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it.each([
    undefined,
    null,
    "",
    "   ",
    "defense:sched-1",
    "sched 1",
    "a".repeat(129),
    42,
    {},
  ])("rejects an invalid schedule id (%j) without querying the store", async (value) => {
    const store = makeStore();

    await expect(
      authorizeDefenseRoomJoin(store, value as never, "u-1"),
    ).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(store.getSessionStatus).not.toHaveBeenCalled();
  });
});

describe("resolveDefenseDeliveryAuthorization", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"])(
    "delivers to assigned members while the session is %s",
    async (status) => {
      const store = makeStore({
        getSessionStatus: vi.fn(async () => status),
        listAssignedUserIds: vi.fn(async () => new Set(["u-1", "u-2"])),
      });

      const result = await resolveDefenseDeliveryAuthorization(
        store,
        "sched-1",
        "annotation.created",
        ["u-1", "u-2", "u-removed"],
      );

      expect(result).toEqual({
        deliver: true,
        authorizedUserIds: new Set(["u-1", "u-2"]),
      });
      expect(store.listAssignedUserIds).toHaveBeenCalledWith("sched-1", [
        "u-1",
        "u-2",
        "u-removed",
      ]);
    },
  );

  it("delivers defense.concluded after the attempt has become CONCLUDED", async () => {
    const store = makeStore({
      getSessionStatus: vi.fn(async () => "CONCLUDED"),
      listAssignedUserIds: vi.fn(async () => new Set(["u-1"])),
    });

    await expect(
      resolveDefenseDeliveryAuthorization(store, "sched-1", "defense.concluded", [
        "u-1",
      ]),
    ).resolves.toEqual({ deliver: true, authorizedUserIds: new Set(["u-1"]) });
  });

  it.each<DefenseRealtimeEventName>([
    "defense.started",
    "annotation.created",
    "annotation.comment.created",
    "report.draft.updated",
    "evaluation.finalized",
    "report.ready_for_signature",
    "rap.signature.recorded",
    "rap.finalized",
  ])("drops %s for a CONCLUDED attempt", async (eventName) => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => "CONCLUDED") });

    await expect(
      resolveDefenseDeliveryAuthorization(store, "sched-1", eventName, ["u-1"]),
    ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
    expect(store.listAssignedUserIds).not.toHaveBeenCalled();
  });

  it("drops every event for a CANCELLED attempt", async () => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => "CANCELLED") });

    await expect(
      resolveDefenseDeliveryAuthorization(store, "sched-1", "defense.concluded", [
        "u-1",
      ]),
    ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
  });

  it.each<DefenseRealtimeEventName>([
    "defense.started",
    "annotation.created",
    "annotation.comment.created",
    "report.draft.updated",
    "evaluation.finalized",
    "report.ready_for_signature",
    "rap.signature.recorded",
    "rap.finalized",
    "defense.concluded",
  ])("drops %s for a CANCELLED attempt (acceptance matrix)", async (eventName) => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => "CANCELLED") });

    await expect(
      resolveDefenseDeliveryAuthorization(store, "sched-1", eventName, ["u-1"]),
    ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
    expect(store.listAssignedUserIds).not.toHaveBeenCalled();
  });

  it("fails closed for a missing schedule", async () => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => null) });

    await expect(
      resolveDefenseDeliveryAuthorization(store, "sched-missing", "annotation.created", [
        "u-1",
      ]),
    ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
  });
});
