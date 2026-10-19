/**
 * CDW-LIVE-1A — ephemeral report preview transport.
 *
 * `report:preview` is relayed outside the CDW-8 post-commit publisher. It never
 * persists report content and never executes an academic write. Every message is
 * re-authorized against the exact current PanelAssignment before delivery.
 */

import {
  authorizeDefenseReportPreviewSender,
  resolveDefenseReportPreviewDelivery,
  type DefenseReportPreviewStore,
} from "./defense-report-preview.authorization";
import {
  DEFENSE_REPORT_PREVIEW_EVENT,
  parseDefenseReportPreviewPayload,
  type DefenseReportPreview,
  type DefenseReportPreviewDelivery,
} from "./defense-report-preview.rules";
import {
  defenseRoomName,
  isValidDefenseScheduleId,
  type DefenseRealtimeLogger,
} from "./defense-realtime.types";

export type DefenseReportPreviewErrorCode =
  | "FORBIDDEN"
  | "NOT_ACTIVE"
  | "INVALID"
  | "STALE"
  | "DROPPED";

export type DefenseReportPreviewAck =
  | { ok: true }
  | { ok: false; code: DefenseReportPreviewErrorCode };

export interface ReportPreviewSocketData {
  userId?: string;
  defenseRoom?: string;
  lastReportPreviewSequence?: number;
  [key: string]: unknown;
}

export interface ReportPreviewSenderSocket {
  id?: string;
  data: ReportPreviewSocketData;
}

export interface ReportPreviewRemoteSocket {
  id: string;
  data: ReportPreviewSocketData;
  leave(room: string): void | Promise<void>;
}

export interface ReportPreviewIo {
  in(room: string): {
    fetchSockets(): Promise<ReportPreviewRemoteSocket[]>;
  };
  to(target: string): {
    emit(eventName: string, payload: unknown): unknown;
  };
}

export interface DefenseReportPreviewDeliveryInput {
  room: string;
  scheduleId: string;
  senderUserId: string;
  senderSocketId?: string;
  preview: DefenseReportPreview;
}

export interface DefenseReportPreviewDeliveryDeps {
  io: ReportPreviewIo;
  store: DefenseReportPreviewStore;
  logger?: DefenseRealtimeLogger;
}

const DEFAULT_LOGGER: DefenseRealtimeLogger = console;

/**
 * Delivers a preview only to currently authorized, non-sender room members.
 * Stale members are evicted first. Any lookup/revalidation failure drops the
 * message (fail closed) rather than widening access.
 */
export function createDefenseReportPreviewDelivery(
  deps: DefenseReportPreviewDeliveryDeps,
): (input: DefenseReportPreviewDeliveryInput) => Promise<boolean> {
  const logger = deps.logger ?? DEFAULT_LOGGER;

  return async (input) => {
    if (!isValidDefenseScheduleId(input.scheduleId)) {
      return false;
    }

    const expectedRoom = defenseRoomName(input.scheduleId);
    if (input.room !== expectedRoom) {
      logger.error("Refusing report preview delivery to a non-canonical room", {
        scheduleId: input.scheduleId,
        code: "FORBIDDEN",
      });
      return false;
    }

    let sockets: ReportPreviewRemoteSocket[];
    try {
      sockets = await deps.io.in(expectedRoom).fetchSockets();
    } catch {
      logger.error("Report preview room lookup failed", {
        scheduleId: input.scheduleId,
        code: "DROPPED",
      });
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
      authorization = await resolveDefenseReportPreviewDelivery(
        deps.store,
        input.scheduleId,
        connectedUserIds,
      );
    } catch {
      logger.error("Report preview membership revalidation failed", {
        scheduleId: input.scheduleId,
        code: "DROPPED",
      });
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
        } catch {
          logger.error("Report preview stale-member eviction failed", {
            scheduleId: input.scheduleId,
            code: "DROPPED",
          });
          return false;
        }

        if (socket.data?.defenseRoom === expectedRoom) {
          socket.data.defenseRoom = undefined;
        }
      }
    }

    const delivered: DefenseReportPreviewDelivery = {
      ...input.preview,
      senderUserId: input.senderUserId,
    };

    for (const socket of sockets) {
      const userId = socket.data?.userId;
      if (
        typeof userId !== "string" ||
        !authorization.authorizedUserIds.has(userId) ||
        socket.id === input.senderSocketId ||
        userId === input.senderUserId
      ) {
        continue;
      }

      try {
        deps.io.to(socket.id).emit(DEFENSE_REPORT_PREVIEW_EVENT, delivered);
      } catch {
        logger.error("Report preview delivery failed", {
          scheduleId: input.scheduleId,
          code: "DROPPED",
        });
        return false;
      }
    }

    return true;
  };
}

export interface DefenseReportPreviewHandlerDeps {
  store: DefenseReportPreviewStore;
  deliver: (input: DefenseReportPreviewDeliveryInput) => Promise<boolean>;
  logger?: DefenseRealtimeLogger;
}

/**
 * Socket handler for `report:preview`. The socket identity is authoritative;
 * client-supplied userId/role fields are ignored. The socket must already have
 * joined the exact intended defense room.
 */
export function createDefenseReportPreviewHandler(
  deps: DefenseReportPreviewHandlerDeps,
): (
  socket: ReportPreviewSenderSocket,
  payload: unknown,
  ack?: (result: DefenseReportPreviewAck) => void,
) => Promise<void> {
  const logger = deps.logger ?? DEFAULT_LOGGER;

  return async (socket, payload, ack) => {
    const respond = typeof ack === "function" ? ack : () => undefined;
    const userId = socket.data?.userId;

    if (typeof userId !== "string" || userId.length === 0) {
      respond({ ok: false, code: "FORBIDDEN" });
      return;
    }

    const parsed = parseDefenseReportPreviewPayload(payload);
    if (!parsed.ok) {
      respond({ ok: false, code: "INVALID" });
      return;
    }

    const { preview } = parsed;
    const expectedRoom = defenseRoomName(preview.scheduleId);

    if (socket.data?.defenseRoom !== expectedRoom) {
      respond({ ok: false, code: "FORBIDDEN" });
      return;
    }

    const previousSequence = socket.data?.lastReportPreviewSequence;
    if (
      typeof previousSequence === "number" &&
      preview.previewSequence <= previousSequence
    ) {
      respond({ ok: false, code: "STALE" });
      return;
    }

    let authorization;
    try {
      authorization = await authorizeDefenseReportPreviewSender(
        deps.store,
        preview.scheduleId,
        userId,
      );
    } catch {
      logger.error("Report preview sender authorization failed", {
        scheduleId: preview.scheduleId,
        code: "FORBIDDEN",
      });
      respond({ ok: false, code: "FORBIDDEN" });
      return;
    }

    if (!authorization.ok) {
      respond({ ok: false, code: authorization.code });
      return;
    }

    socket.data.lastReportPreviewSequence = preview.previewSequence;

    const delivered = await deps.deliver({
      room: expectedRoom,
      scheduleId: preview.scheduleId,
      senderUserId: userId,
      ...(typeof socket.id === "string" && socket.id.length > 0
        ? { senderSocketId: socket.id }
        : {}),
      preview,
    });

    respond(delivered ? { ok: true } : { ok: false, code: "DROPPED" });
  };
}
