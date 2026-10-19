import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/database", () => ({ default: {} }));

import {
  createDefenseJoinHandler,
  createDefenseLeaveHandler,
  createDefenseRealtimeDelivery,
} from "../../../src/realtime/defense-realtime.server";
import type { DefenseRealtimeAuthorizationStore } from "../../../src/realtime/defense-realtime.authorization";
import type {
  DefenseRealtimeEvent,
  DefenseRealtimeEventName,
} from "../../../src/realtime/defense-realtime.types";

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

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function makeAck() {
  return vi.fn();
}

function makeSocket(userId?: string) {
  const data: Record<string, unknown> = userId ? { userId } : {};
  const socket = {
    data,
    join: vi.fn(async () => undefined),
    leave: vi.fn(async () => undefined),
  };
  return socket;
}

function makeEvent(
  eventName: DefenseRealtimeEventName,
  scheduleId = "sched-1",
): DefenseRealtimeEvent {
  return {
    eventId: "evt-1",
    scheduleId,
    occurredAt: "2026-10-17T00:00:00.000Z",
    ...(eventName === "defense.started" || eventName === "defense.concluded"
      ? { sessionStatus: eventName === "defense.started" ? "IN_PROGRESS" : "CONCLUDED" }
      : {}),
  } as DefenseRealtimeEvent;
}

function makeDeliveryIo(sockets: Array<ReturnType<typeof makeSocket>>, steps: string[] = []) {
  const members = new Set(sockets);
  for (const socket of sockets) {
    socket.leave.mockImplementation(async () => {
      members.delete(socket);
      steps.push(`leave:${String(socket.data.userId ?? "anonymous")}`);
    });
  }
  const emissions: Array<{
    room: string;
    event: string;
    payload: unknown;
    recipients: unknown[];
  }> = [];
  const io = {
    in: (room: string) => ({
      fetchSockets: async () =>
        room === "defense:sched-1" ? Array.from(members) : [],
    }),
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        steps.push("emit");
        emissions.push({
          room,
          event,
          payload,
          recipients: Array.from(members).map((socket) => socket.data.userId),
        });
      },
    }),
  };
  return { io, members, emissions, steps };
}

describe("defense:join handler", () => {
  it("joins the server-derived room for an assigned active member", async () => {
    const store = makeStore();
    const handler = createDefenseJoinHandler({ store, logger: makeLogger() });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(socket.join).toHaveBeenCalledWith("defense:sched-1");
    expect(socket.data.defenseRoom).toBe("defense:sched-1");
    expect(ack).toHaveBeenCalledWith({ ok: true, room: "defense:sched-1" });
    expect(store.hasPanelAssignment).toHaveBeenCalledWith("sched-1", "u-1");
  });

  it("never trusts a client-supplied raw room name", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore(),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(
      socket as never,
      { scheduleId: "sched-1", room: "thesis:all" } as never,
      ack,
    );

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith("defense:sched-1");
    expect(socket.join).not.toHaveBeenCalledWith("thesis:all");
  });

  it("uses the authenticated socket identity, not join payload identity", async () => {
    const store = makeStore();
    const handler = createDefenseJoinHandler({ store, logger: makeLogger() });
    const socket = makeSocket("u-1");
    socket.data.role = "PANELIST";
    const ack = makeAck();

    await handler(
      socket as never,
      {
        scheduleId: "sched-1",
        userId: "attacker",
        role: "ADMIN",
      } as never,
      ack,
    );

    expect(store.hasPanelAssignment).toHaveBeenCalledWith("sched-1", "u-1");
    expect(store.hasPanelAssignment).not.toHaveBeenCalledWith(
      "sched-1",
      "attacker",
    );
    expect(ack).toHaveBeenCalledWith({ ok: true, room: "defense:sched-1" });
  });

  it("denies an unassigned user with a safe code", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore({ hasPanelAssignment: vi.fn(async () => false) }),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-2");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(socket.join).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
  });

  it("does not authorize from a broad account role alone", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore({ hasPanelAssignment: vi.fn(async () => false) }),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-2");
    socket.data.role = "PANELIST";
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(socket.join).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
  });

  it("denies a CONCLUDED attempt", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore({ getSessionStatus: vi.fn(async () => "CONCLUDED") }),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(socket.join).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "NOT_ACTIVE" });
  });

  it("denies a CANCELLED attempt", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore({ getSessionStatus: vi.fn(async () => "CANCELLED") }),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, code: "NOT_ACTIVE" });
  });

  it("returns NOT_FOUND for a missing schedule", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore({ getSessionStatus: vi.fn(async () => null) }),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-missing" }, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, code: "NOT_FOUND" });
  });

  it("denies a socket with no authenticated identity", async () => {
    const store = makeStore();
    const handler = createDefenseJoinHandler({ store, logger: makeLogger() });
    const socket = makeSocket();
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(store.getSessionStatus).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
  });

  it("fails closed and logs when authorization storage throws", async () => {
    const logger = makeLogger();
    const handler = createDefenseJoinHandler({
      store: makeStore({
        getSessionStatus: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      }),
      logger,
    });
    const socket = makeSocket("u-1");
    const ack = makeAck();

    await handler(socket as never, { scheduleId: "sched-1" }, ack);

    expect(socket.join).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
    expect(logger.error).toHaveBeenCalled();
  });

  it("re-runs assignment authorization on every reconnect/join", async () => {
    const hasPanelAssignment = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const handler = createDefenseJoinHandler({
      store: makeStore({ hasPanelAssignment }),
      logger: makeLogger(),
    });

    const firstSocket = makeSocket("u-1");
    const firstAck = makeAck();
    await handler(firstSocket as never, { scheduleId: "sched-1" }, firstAck);

    const reconnectedSocket = makeSocket("u-1");
    const secondAck = makeAck();
    await handler(reconnectedSocket as never, { scheduleId: "sched-1" }, secondAck);

    expect(firstAck).toHaveBeenCalledWith({ ok: true, room: "defense:sched-1" });
    expect(secondAck).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
    expect(reconnectedSocket.join).not.toHaveBeenCalled();
    expect(hasPanelAssignment).toHaveBeenCalledTimes(2);
  });

  it("leaves the previous defense room when joining another attempt", async () => {
    const handler = createDefenseJoinHandler({
      store: makeStore(),
      logger: makeLogger(),
    });
    const socket = makeSocket("u-1");
    socket.data.defenseRoom = "defense:sched-old";

    await handler(socket as never, { scheduleId: "sched-1" }, makeAck());

    expect(socket.leave).toHaveBeenCalledWith("defense:sched-old");
    expect(socket.join).toHaveBeenCalledWith("defense:sched-1");
  });
});

describe("defense:leave handler", () => {
  it("leaves only the tracked defense room and clears the tracking state", async () => {
    const handler = createDefenseLeaveHandler();
    const socket = makeSocket("u-1");
    socket.data.defenseRoom = "defense:sched-1";
    const ack = makeAck();

    await handler(socket as never, ack);

    expect(socket.leave).toHaveBeenCalledWith("defense:sched-1");
    expect(socket.data.defenseRoom).toBeUndefined();
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it("contains a leave failure and reports a safe denial", async () => {
    const logger = makeLogger();
    const handler = createDefenseLeaveHandler({ logger });
    const socket = makeSocket("u-1");
    socket.data.defenseRoom = "defense:sched-1";
    socket.leave.mockRejectedValue(new Error("transport closed"));
    const ack = makeAck();

    await expect(handler(socket as never, ack)).resolves.toBeUndefined();

    expect(socket.data.defenseRoom).toBe("defense:sched-1");
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("defense realtime delivery", () => {
  it("rejects a room that is not the canonical room for the event schedule", async () => {
    const logger = makeLogger();
    const { io, emissions } = makeDeliveryIo([]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore(),
      logger,
    });

    await expect(
      deliver({
        room: "defense:other",
        eventName: "annotation.created",
        event: makeEvent("annotation.created"),
      }),
    ).resolves.toBe(false);

    expect(emissions).toHaveLength(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it("rejects an invalid schedule id before any room lookup", async () => {
    const logger = makeLogger();
    const { io, emissions, members } = makeDeliveryIo([makeSocket("u-1")]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore(),
      logger,
    });

    await expect(
      deliver({
        room: "defense:defense:all",
        eventName: "evaluation.finalized",
        event: {
          eventId: "evt-1",
          scheduleId: "defense:all",
          occurredAt: "2026-10-17T00:00:00.000Z",
        } as never,
      }),
    ).resolves.toBe(false);

    expect(members.size).toBe(1);
    expect(emissions).toHaveLength(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it("evicts a removed member before delivering to the remaining room", async () => {
    const steps: string[] = [];
    const socketA = makeSocket("u-1");
    const socketB = makeSocket("u-removed");
    const { io, emissions } = makeDeliveryIo([socketA, socketB], steps);
    const store = makeStore({
      listAssignedUserIds: vi.fn(async () => new Set(["u-1"])),
    });
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store,
      logger: makeLogger(),
    });
    const event = makeEvent("annotation.created");

    await expect(
      deliver({ room: "defense:sched-1", eventName: "annotation.created", event }),
    ).resolves.toBe(true);

    expect(socketB.leave).toHaveBeenCalledWith("defense:sched-1");
    expect(socketA.leave).not.toHaveBeenCalled();
    expect(steps.indexOf("leave:u-removed")).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf("leave:u-removed")).toBeLessThan(steps.indexOf("emit"));
    expect(emissions).toHaveLength(1);
    expect(emissions[0].room).toBe("defense:sched-1");
    expect(emissions[0].event).toBe("annotation.created");
    expect(emissions[0].payload).toBe(event);
    expect(emissions[0].recipients).toEqual(["u-1"]);
  });

  it("fails closed and does not emit when membership revalidation throws", async () => {
    const logger = makeLogger();
    const socketA = makeSocket("u-1");
    const { io, emissions } = makeDeliveryIo([socketA]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore({
        getSessionStatus: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      }),
      logger,
    });

    await expect(
      deliver({
        room: "defense:sched-1",
        eventName: "evaluation.finalized",
        event: makeEvent("evaluation.finalized"),
      }),
    ).resolves.toBe(false);

    expect(emissions).toHaveLength(0);
    expect(socketA.leave).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("delivers defense.concluded after the attempt becomes CONCLUDED", async () => {
    const socketA = makeSocket("u-1");
    const { io, emissions } = makeDeliveryIo([socketA]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore({ getSessionStatus: vi.fn(async () => "CONCLUDED") }),
      logger: makeLogger(),
    });
    const event = makeEvent("defense.concluded");

    await expect(
      deliver({ room: "defense:sched-1", eventName: "defense.concluded", event }),
    ).resolves.toBe(true);

    expect(emissions).toHaveLength(1);
    expect(emissions[0].payload).toBe(event);
  });

  it("drops non-conclusion events after the attempt is CONCLUDED", async () => {
    const { io, emissions } = makeDeliveryIo([makeSocket("u-1")]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore({ getSessionStatus: vi.fn(async () => "CONCLUDED") }),
      logger: makeLogger(),
    });

    await expect(
      deliver({
        room: "defense:sched-1",
        eventName: "evaluation.finalized",
        event: makeEvent("evaluation.finalized"),
      }),
    ).resolves.toBe(false);

    expect(emissions).toHaveLength(0);
  });

  it("drops events for a CANCELLED attempt", async () => {
    const { io, emissions } = makeDeliveryIo([makeSocket("u-1")]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore({ getSessionStatus: vi.fn(async () => "CANCELLED") }),
      logger: makeLogger(),
    });

    await expect(
      deliver({
        room: "defense:sched-1",
        eventName: "defense.concluded",
        event: makeEvent("defense.concluded"),
      }),
    ).resolves.toBe(false);

    expect(emissions).toHaveLength(0);
  });

  it("evicts sockets without a verified identity", async () => {
    const anonymous = makeSocket();
    const assigned = makeSocket("u-1");
    const { io, emissions } = makeDeliveryIo([anonymous, assigned]);
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store: makeStore({ listAssignedUserIds: vi.fn(async () => new Set(["u-1"])) }),
      logger: makeLogger(),
    });

    await expect(
      deliver({
        room: "defense:sched-1",
        eventName: "defense.started",
        event: makeEvent("defense.started"),
      }),
    ).resolves.toBe(true);

    expect(anonymous.leave).toHaveBeenCalledWith("defense:sched-1");
    expect(emissions[0].recipients).toEqual(["u-1"]);
  });

  it("delivers duplicate events as repeated harmless invalidations only", async () => {
    const socketA = makeSocket("u-1");
    const { io, emissions } = makeDeliveryIo([socketA]);
    const store = makeStore({
      listAssignedUserIds: vi.fn(async () => new Set(["u-1"])),
    });
    const deliver = createDefenseRealtimeDelivery({
      io: io as never,
      store,
      logger: makeLogger(),
    });
    const event = makeEvent("annotation.created");

    await expect(
      deliver({ room: "defense:sched-1", eventName: "annotation.created", event }),
    ).resolves.toBe(true);
    await expect(
      deliver({ room: "defense:sched-1", eventName: "annotation.created", event }),
    ).resolves.toBe(true);

    expect(emissions).toHaveLength(2);
    expect(emissions[0].payload).toBe(event);
    expect(emissions[1].payload).toBe(event);
    // The authorization port is read-only; delivery cannot mutate defense data.
    expect(Object.keys(store).sort()).toEqual([
      "getSessionStatus",
      "hasPanelAssignment",
      "listAssignedUserIds",
    ]);
  });
});
