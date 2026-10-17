import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import {
  createDefenseSocketAuthMiddleware,
  type DefenseSocketAuthOptions,
} from "./defense-realtime.auth";
import {
  authorizeDefenseRoomJoin,
  resolveDefenseDeliveryAuthorization,
  type DefenseRealtimeAuthorizationStore,
} from "./defense-realtime.authorization";
import type { DefenseReportPreviewStore } from "./defense-report-preview.authorization";
import {
  createDefenseReportPreviewDelivery,
  createDefenseReportPreviewHandler,
} from "./defense-report-preview.server";
import { DEFENSE_REPORT_PREVIEW_EVENT } from "./defense-report-preview.rules";
import { createPrismaDefenseReportPreviewStore } from "./defense-report-preview.store";
import { createPrismaDefenseRealtimeStore } from "./defense-realtime.store";
import {
  getDefenseRealtimeServer,
  setDefenseRealtimeServer,
} from "./defense-realtime.registry";
import {
  DEFENSE_JOIN_EVENT,
  DEFENSE_LEAVE_EVENT,
  defenseRoomName,
  isValidDefenseScheduleId,
  type DefenseJoinAck,
  type DefenseLeaveAck,
  type DefenseRealtimeEvent,
  type DefenseRealtimeEventName,
  type DefenseRealtimeLogger,
} from "./defense-realtime.types";

export interface DefenseRealtimeSocketData {
  userId?: string;
  role?: string;
  defenseRoom?: string;
  [key: string]: unknown;
}

export interface DefenseRealtimeJoinSocket {
  data: DefenseRealtimeSocketData;
  join(room: string): void | Promise<void>;
  leave(room: string): void | Promise<void>;
}

export interface DefenseRealtimeRemoteSocket {
  data: DefenseRealtimeSocketData;
  leave(room: string): void | Promise<void>;
}

export interface DefenseRealtimeIo {
  in(room: string): {
    fetchSockets(): Promise<DefenseRealtimeRemoteSocket[]>;
  };
  to(room: string): {
    emit(eventName: string, payload: unknown): unknown;
  };
}

export interface DefenseRealtimeDeliveryInput {
  room: string;
  eventName: DefenseRealtimeEventName;
  event: DefenseRealtimeEvent;
}

export interface DefenseRealtimeDeliveryDeps {
  io: DefenseRealtimeIo;
  store: DefenseRealtimeAuthorizationStore;
  logger?: DefenseRealtimeLogger;
}

export interface DefenseRealtimeServerOptions extends DefenseSocketAuthOptions {
  store?: DefenseRealtimeAuthorizationStore;
  reportPreviewStore?: DefenseReportPreviewStore;
  logger?: DefenseRealtimeLogger;
  corsOrigin?: string | string[];
}

export interface DefenseRealtimeServer {
  io: SocketIOServer;
  deliver(input: DefenseRealtimeDeliveryInput): Promise<boolean>;
  shutdown(): Promise<void>;
}

const DEFAULT_LOGGER: DefenseRealtimeLogger = console;

/**
 * Transport-control join handler. The room name is always derived from the
 * validated schedule id; client-supplied room names are ignored.
 */
export function createDefenseJoinHandler(deps: {
  store: DefenseRealtimeAuthorizationStore;
  logger?: DefenseRealtimeLogger;
}) {
  const logger = deps.logger ?? DEFAULT_LOGGER;

  return async (
    socket: DefenseRealtimeJoinSocket,
    payload: unknown,
    ack?: (result: DefenseJoinAck) => void,
  ): Promise<void> => {
    const respond = typeof ack === "function" ? ack : () => undefined;
    const userId = socket.data?.userId;

    if (typeof userId !== "string" || userId.length === 0) {
      respond({ ok: false, code: "FORBIDDEN" });
      return;
    }

    const scheduleId =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { scheduleId?: unknown }).scheduleId
        : undefined;

    try {
      const result = await authorizeDefenseRoomJoin(
        deps.store,
        scheduleId,
        userId,
      );

      if (!result.ok) {
        respond(result);
        return;
      }

      const previousRoom = socket.data.defenseRoom;
      if (previousRoom && previousRoom !== result.room) {
        await socket.leave(previousRoom);
      }

      await socket.join(result.room);
      socket.data.defenseRoom = result.room;
      respond(result);
    } catch (error) {
      logger.error("Defense realtime join authorization failed", error);
      respond({ ok: false, code: "FORBIDDEN" });
    }
  };
}

/**
 * Explicit leave is optional; unmount/disconnect cleanup is handled by
 * Socket.IO. It only ever leaves the tracked defense room.
 */
export function createDefenseLeaveHandler(
  deps: { logger?: DefenseRealtimeLogger } = {},
) {
  const logger = deps.logger ?? DEFAULT_LOGGER;

  return async (
    socket: DefenseRealtimeJoinSocket,
    ack?: (result: DefenseLeaveAck) => void,
  ): Promise<void> => {
    const room = socket.data?.defenseRoom;

    try {
      if (room) {
        await socket.leave(room);
        socket.data.defenseRoom = undefined;
      }

      if (typeof ack === "function") {
        ack({ ok: true });
      }
    } catch (error) {
      logger.error("Defense realtime leave failed", error);
      if (typeof ack === "function") {
        ack({ ok: false, code: "FORBIDDEN" });
      }
    }
  };
}

/**
 * Best-effort delivery with pre-delivery revalidation. If schedule/assignment
 * revalidation cannot be completed, the event is dropped rather than widening
 * access. Unauthorized sockets are evicted before the emit; a failed eviction
 * also drops the event.
 */
export function createDefenseRealtimeDelivery(
  deps: DefenseRealtimeDeliveryDeps,
): (input: DefenseRealtimeDeliveryInput) => Promise<boolean> {
  const logger = deps.logger ?? DEFAULT_LOGGER;

  return async (input) => {
    if (!isValidDefenseScheduleId(input.event.scheduleId)) {
      logger.error("Refusing defense realtime delivery for an invalid schedule id");
      return false;
    }

    const expectedRoom = defenseRoomName(input.event.scheduleId);

    if (input.room !== expectedRoom) {
      logger.error("Refusing defense realtime delivery to a non-canonical room", {
        room: input.room,
        scheduleId: input.event.scheduleId,
      });
      return false;
    }

    let sockets: DefenseRealtimeRemoteSocket[];
    try {
      sockets = await deps.io.in(expectedRoom).fetchSockets();
    } catch (error) {
      logger.error("Defense realtime room lookup failed", error);
      return false;
    }

    const connectedUserIds = Array.from(
      new Set(
        sockets
          .map((socket) => socket.data?.userId)
          .filter(
            (userId): userId is string =>
              typeof userId === "string" && userId.length > 0,
          ),
      ),
    );

    let authorization;
    try {
      authorization = await resolveDefenseDeliveryAuthorization(
        deps.store,
        input.event.scheduleId,
        input.eventName,
        connectedUserIds,
      );
    } catch (error) {
      logger.error("Defense realtime membership revalidation failed", error);
      return false;
    }

    if (!authorization.deliver) {
      return false;
    }

    for (const socket of sockets) {
      const userId = socket.data?.userId;

      if (
        typeof userId !== "string" ||
        userId.length === 0 ||
        !authorization.authorizedUserIds.has(userId)
      ) {
        try {
          await socket.leave(expectedRoom);
        } catch (error) {
          logger.error("Defense realtime stale-member eviction failed", error);
          return false;
        }

        if (socket.data?.defenseRoom === expectedRoom) {
          socket.data.defenseRoom = undefined;
        }
      }
    }

    try {
      deps.io.to(expectedRoom).emit(input.eventName, input.event);
    } catch (error) {
      logger.error("Defense realtime event delivery failed", error);
      return false;
    }

    return true;
  };
}

/**
 * Attach exactly one Socket.IO server to the caller's existing HTTP server.
 * This function never opens a second port or starts its own listener.
 */
export function initializeDefenseRealtime(
  httpServer: HttpServer,
  options: DefenseRealtimeServerOptions = {},
): DefenseRealtimeServer {
  if (getDefenseRealtimeServer()) {
    throw new Error("Defense realtime is already initialized");
  }

  const logger = options.logger ?? DEFAULT_LOGGER;
  const store =
    options.store ??
    createPrismaDefenseRealtimeStore();
  const reportPreviewStore =
    options.reportPreviewStore ?? createPrismaDefenseReportPreviewStore();

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        options.corsOrigin ??
        process.env.FRONTEND_URL ??
        "http://localhost:3000",
      credentials: true,
    },
  });

  const deliver = createDefenseRealtimeDelivery({
    io: io as unknown as DefenseRealtimeIo,
    store,
    logger,
  });
  const joinHandler = createDefenseJoinHandler({ store, logger });
  const leaveHandler = createDefenseLeaveHandler({ logger });
  const reportPreviewDeliver = createDefenseReportPreviewDelivery({
    io: io as unknown as Parameters<
      typeof createDefenseReportPreviewDelivery
    >[0]["io"],
    store: reportPreviewStore,
    logger,
  });
  const reportPreviewHandler = createDefenseReportPreviewHandler({
    store: reportPreviewStore,
    deliver: reportPreviewDeliver,
    logger,
  });

  io.use(
    createDefenseSocketAuthMiddleware({
      verifyToken: options.verifyToken,
    }),
  );

  io.on("connection", (socket) => {
    socket.on(
      DEFENSE_JOIN_EVENT,
      (payload: unknown, ack?: (result: DefenseJoinAck) => void) => {
        void joinHandler(
          socket as unknown as DefenseRealtimeJoinSocket,
          payload,
          ack,
        );
      },
    );

    socket.on(
      DEFENSE_LEAVE_EVENT,
      (ack?: (result: DefenseLeaveAck) => void) => {
        void leaveHandler(
          socket as unknown as DefenseRealtimeJoinSocket,
          ack,
        );
      },
    );

    // CDW-LIVE-1A: ephemeral, transport-only report preview. Deliberately not
    // part of the canonical nine-event publisher and never persisted.
    socket.on(
      DEFENSE_REPORT_PREVIEW_EVENT,
      (
        payload: unknown,
        ack?: (result: { ok: true } | { ok: false; code: string }) => void,
      ) => {
        void reportPreviewHandler(
          socket as unknown as Parameters<typeof reportPreviewHandler>[0],
          payload,
          ack,
        );
      },
    );
  });

  const server: DefenseRealtimeServer = {
    io,
    deliver,
    async shutdown(): Promise<void> {
      await io.close();
    },
  };

  setDefenseRealtimeServer(server);
  return server;
}

/**
 * The publisher resolves this at publish time, so it stays a safe no-op before
 * bootstrap and during shutdown.
 */
export { getDefenseRealtimeServer };

/**
 * Graceful/test shutdown. The singleton is cleared before closing so a
 * subsequent initialization is possible.
 */
export async function shutdownDefenseRealtime(): Promise<void> {
  const server = getDefenseRealtimeServer();
  if (!server) {
    return;
  }

  setDefenseRealtimeServer(null);
  await server.shutdown();
}
