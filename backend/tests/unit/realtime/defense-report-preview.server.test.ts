import { describe, expect, it, vi } from "vitest";

import {
  createDefenseReportPreviewDelivery,
  createDefenseReportPreviewHandler,
  type ReportPreviewIo,
  type ReportPreviewRemoteSocket,
} from "../../../src/realtime/defense-report-preview.server";
import type {
  DefenseReportPreviewStore,
  ReportPreviewSenderState,
} from "../../../src/realtime/defense-report-preview.authorization";

function makeState(
  overrides: Partial<ReportPreviewSenderState> = {},
): ReportPreviewSenderState {
  return {
    sessionStatus: "IN_PROGRESS",
    role: "RAPPORTEUR",
    rapStatus: "DRAFT",
    rapFrozenAt: null,
    ...overrides,
  };
}

function makeStore(
  overrides: Partial<DefenseReportPreviewStore> = {},
): DefenseReportPreviewStore {
  return {
    getSessionStatus: vi.fn(async () => "IN_PROGRESS"),
    listAssignedUserIds: vi.fn(async () => new Set(["rapporteur-1", "panelist-1"])),
    getReportPreviewSenderState: vi.fn(async () => makeState()),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function makePreview(overrides: Record<string, unknown> = {}) {
  return {
    scheduleId: "sched-1",
    baseBodyVersion: 2,
    previewSequence: 4,
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Live committee wording", marks: [] }],
        },
      ],
    },
    ...overrides,
  };
}

function makeSenderSocket(userId = "rapporteur-1", room = "defense:sched-1") {
  return {
    data: {
      ...(userId ? { userId } : {}),
      ...(room ? { defenseRoom: room } : {}),
    } as Record<string, unknown>,
  };
}

function remoteSocket(
  id: string,
  userId: string | undefined,
  steps: string[] = [],
): ReportPreviewRemoteSocket {
  return {
    id,
    data: userId ? { userId } : {},
    leave: vi.fn(async () => {
      steps.push(`leave:${userId ?? "anonymous"}`);
    }),
  };
}

function makeIo(
  sockets: ReportPreviewRemoteSocket[],
  steps: string[] = [],
): {
  io: ReportPreviewIo;
  members: Set<ReportPreviewRemoteSocket>;
  emissions: Array<{ target: string; event: string; payload: unknown }>;
} {
  const members = new Set(sockets);
  const emissions: Array<{ target: string; event: string; payload: unknown }> = [];
  for (const socket of sockets) {
    (socket.leave as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      members.delete(socket);
      steps.push(`leave:${String(socket.data.userId ?? "anonymous")}`);
    });
  }
  return {
    members,
    emissions,
    io: {
      in: (room: string) => ({
        fetchSockets: async () =>
          room === "defense:sched-1" ? Array.from(members) : [],
      }),
      to: (target: string) => ({
        emit: (event: string, payload: unknown) => {
          steps.push(`emit:${target}`);
          emissions.push({ target, event, payload });
        },
      }),
    },
  };
}

describe("report:preview handler", () => {
  it("relays an authorized Rapporteur preview with the authenticated sender identity", async () => {
    const store = makeStore();
    const deliver = vi.fn(async () => true);
    const logger = makeLogger();
    const handler = createDefenseReportPreviewHandler({ store, deliver, logger });
    const socket = makeSenderSocket();
    const ack = vi.fn();

    await handler(socket as never, makePreview(), ack);

    expect(deliver).toHaveBeenCalledWith({
      room: "defense:sched-1",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      preview: expect.objectContaining({
        scheduleId: "sched-1",
        baseBodyVersion: 2,
        previewSequence: 4,
      }),
    });
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(socket.data.lastReportPreviewSequence).toBe(4);
  });

  it("ignores a client-supplied sender id/role and uses socket identity", async () => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore({
        getReportPreviewSenderState: vi.fn(async (_scheduleId, userId) =>
          userId === "rapporteur-1" ? makeState() : makeState({ role: "PANELIST" }),
        ),
      }),
      deliver,
      logger: makeLogger(),
    });
    const socket = makeSenderSocket();

    await handler(
      socket as never,
      { ...makePreview(), userId: "panelist-1", role: "RAPPORTEUR" },
      vi.fn(),
    );

    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ senderUserId: "rapporteur-1" }),
    );
  });

  it("rejects a socket without an authenticated identity", async () => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore(),
      deliver,
      logger: makeLogger(),
    });
    const ack = vi.fn();

    await handler(makeSenderSocket("") as never, makePreview(), ack);

    expect(deliver).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects a sender that has not joined the intended defense room", async () => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore(),
      deliver,
      logger: makeLogger(),
    });
    const ack = vi.fn();

    await handler(makeSenderSocket("rapporteur-1", "") as never, makePreview(), ack);
    await handler(
      makeSenderSocket("rapporteur-1", "defense:other") as never,
      makePreview(),
      ack,
    );

    expect(deliver).not.toHaveBeenCalled();
    expect(ack).toHaveBeenNthCalledWith(1, { ok: false, code: "FORBIDDEN" });
    expect(ack).toHaveBeenNthCalledWith(2, { ok: false, code: "FORBIDDEN" });
  });

  it.each([
    ["PANELIST", "FORBIDDEN"],
    ["CHAIRMAN", "FORBIDDEN"],
    ["ADVISER", "FORBIDDEN"],
    ["FACILITATOR", "FORBIDDEN"],
  ] as const)("rejects a %s sender", async (role, code) => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ role })),
      }),
      deliver,
      logger: makeLogger(),
    });
    const ack = vi.fn();

    await handler(makeSenderSocket("u-2") as never, makePreview(), ack);

    expect(deliver).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code });
  });

  it("rejects a removed/replaced Rapporteur", async () => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ role: "PANELIST" })),
      }),
      deliver,
      logger: makeLogger(),
    });

    await handler(makeSenderSocket("removed-rapporteur") as never, makePreview(), vi.fn());

    expect(deliver).not.toHaveBeenCalled();
  });

  it.each([
    "FOR_SIGNATURE",
    "PARTIALLY_SIGNED",
    "ALL_SIGNED",
    "DISTRIBUTED",
    "FINALIZED",
  ])("rejects preview sending when the report is %s", async (rapStatus) => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ rapStatus })),
      }),
      deliver,
      logger: makeLogger(),
    });

    await handler(makeSenderSocket() as never, makePreview(), vi.fn());

    expect(deliver).not.toHaveBeenCalled();
  });

  it.each(["CONCLUDED", "CANCELLED"])(
    "rejects preview sending while the session is %s",
    async (sessionStatus) => {
      const deliver = vi.fn(async () => true);
      const handler = createDefenseReportPreviewHandler({
        store: makeStore({
          getReportPreviewSenderState: vi.fn(async () => makeState({ sessionStatus })),
        }),
        deliver,
        logger: makeLogger(),
      });
      const ack = vi.fn();

      await handler(makeSenderSocket() as never, makePreview(), ack);

      expect(deliver).not.toHaveBeenCalled();
      expect(ack).toHaveBeenCalledWith({ ok: false, code: "NOT_ACTIVE" });
    },
  );

  it("rejects malformed/oversized payloads before any store lookup", async () => {
    const store = makeStore();
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store,
      deliver,
      logger: makeLogger(),
    });
    const ack = vi.fn();

    await handler(
      makeSenderSocket() as never,
      makePreview({ body: { type: "doc", content: "bad" } }),
      ack,
    );

    expect(store.getReportPreviewSenderState).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "INVALID" });
  });

  it("rejects a non-monotonic preview sequence from the same socket", async () => {
    const deliver = vi.fn(async () => true);
    const handler = createDefenseReportPreviewHandler({
      store: makeStore(),
      deliver,
      logger: makeLogger(),
    });
    const socket = makeSenderSocket();
    const ack = vi.fn();

    await handler(socket as never, makePreview({ previewSequence: 5 }), vi.fn());
    await handler(socket as never, makePreview({ previewSequence: 5 }), ack);
    await handler(socket as never, makePreview({ previewSequence: 4 }), ack);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenNthCalledWith(1, { ok: false, code: "STALE" });
    expect(ack).toHaveBeenNthCalledWith(2, { ok: false, code: "STALE" });
  });

  it("fails closed and logs only metadata when authorization storage fails", async () => {
    const deliver = vi.fn(async () => true);
    const logger = makeLogger();
    const handler = createDefenseReportPreviewHandler({
      store: makeStore({
        getReportPreviewSenderState: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      }),
      deliver,
      logger,
    });
    const ack = vi.fn();

    await handler(makeSenderSocket() as never, makePreview(), ack);

    expect(deliver).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, code: "FORBIDDEN" });
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain("Live committee wording");
    expect(logged).not.toContain("body");
  });
});

describe("report:preview delivery", () => {
  it("delivers only to currently authorized non-sender room members", async () => {
    const steps: string[] = [];
    const sender = remoteSocket("socket-rapporteur", "rapporteur-1", steps);
    const senderOtherTab = remoteSocket("socket-rapporteur-2", "rapporteur-1", steps);
    const panelist = remoteSocket("socket-panelist", "panelist-1", steps);
    const removed = remoteSocket("socket-removed", "removed-user", steps);
    const { io, emissions } = makeIo(
      [sender, senderOtherTab, panelist, removed],
      steps,
    );
    const store = makeStore();
    const deliver = createDefenseReportPreviewDelivery({
      io,
      store,
      logger: makeLogger(),
    });

    const result = await deliver({
      room: "defense:sched-1",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      senderSocketId: "socket-rapporteur",
      preview: makePreview() as never,
    });

    expect(result).toBe(true);
    expect(steps[0]).toBe("leave:removed-user");
    expect(removed.leave).toHaveBeenCalledWith("defense:sched-1");
    expect(emissions).toEqual([
      {
        target: "socket-panelist",
        event: "report:preview",
        payload: {
          ...makePreview(),
          senderUserId: "rapporteur-1",
        },
      },
    ]);
    expect(emissions[0].payload).not.toHaveProperty("privateEvaluation");
  });

  it("drops delivery after conclusion/cancellation and does not emit", async () => {
    const steps: string[] = [];
    const panelist = remoteSocket("socket-panelist", "panelist-1", steps);
    const { io, emissions } = makeIo([panelist], steps);
    const deliver = createDefenseReportPreviewDelivery({
      io,
      store: makeStore({ getSessionStatus: vi.fn(async () => "CONCLUDED") }),
      logger: makeLogger(),
    });

    const result = await deliver({
      room: "defense:sched-1",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      preview: makePreview() as never,
    });

    expect(result).toBe(false);
    expect(emissions).toEqual([]);
  });

  it("fails closed when membership revalidation throws", async () => {
    const steps: string[] = [];
    const panelist = remoteSocket("socket-panelist", "panelist-1", steps);
    const { io, emissions } = makeIo([panelist], steps);
    const logger = makeLogger();
    const deliver = createDefenseReportPreviewDelivery({
      io,
      store: makeStore({
        listAssignedUserIds: vi.fn(async () => {
          throw new Error("db down");
        }),
      }),
      logger,
    });

    const result = await deliver({
      room: "defense:sched-1",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      preview: makePreview() as never,
    });

    expect(result).toBe(false);
    expect(emissions).toEqual([]);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "Live committee wording",
    );
  });

  it("rejects a non-canonical room without fetching sockets", async () => {
    const steps: string[] = [];
    const panelist = remoteSocket("socket-panelist", "panelist-1", steps);
    const { io, emissions } = makeIo([panelist], steps);
    const deliver = createDefenseReportPreviewDelivery({
      io,
      store: makeStore(),
      logger: makeLogger(),
    });

    const result = await deliver({
      room: "defense:other",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      preview: makePreview() as never,
    });

    expect(result).toBe(false);
    expect(emissions).toEqual([]);
  });

  it("never writes the database from the preview path", async () => {
    const panelist = remoteSocket("socket-panelist", "panelist-1");
    const { io } = makeIo([panelist]);
    const store = makeStore();
    const deliver = createDefenseReportPreviewDelivery({
      io,
      store,
      logger: makeLogger(),
    });

    await deliver({
      room: "defense:sched-1",
      scheduleId: "sched-1",
      senderUserId: "rapporteur-1",
      preview: makePreview() as never,
    });

    expect(store.getSessionStatus).toHaveBeenCalledTimes(1);
    expect(store.listAssignedUserIds).toHaveBeenCalledTimes(1);
    expect(store.getReportPreviewSenderState).not.toHaveBeenCalled();
  });
});
