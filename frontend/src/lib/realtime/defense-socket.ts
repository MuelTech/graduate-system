"use client";

/**
 * CDW-8B — the one Socket.IO client factory for the Defense Workspace.
 *
 * Authentication uses the same NextAuth JWT as REST, sent through the Socket.IO
 * handshake `auth` payload. The token is never placed in the URL/query.
 */
import { io, type Socket } from "socket.io-client";

import {
  parseDefenseJoinAck,
  type DefenseJoinAck,
} from "./defense-realtime-events";
import { normalizeDefenseRealtimeBaseUrl } from "./defense-socket-url";

export const DEFENSE_JOIN_EVENT = "defense:join";
export const DEFENSE_LEAVE_EVENT = "defense:leave";
export const DEFENSE_JOIN_TIMEOUT_MS = 5000;

export function createDefenseSocket(accessToken: string): Socket {
  return io(
    normalizeDefenseRealtimeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL),
    {
      auth: { token: accessToken },
      autoConnect: false,
    },
  );
}

export async function joinDefenseRoom(
  socket: Socket,
  scheduleId: string,
): Promise<DefenseJoinAck> {
  try {
    const acknowledgement = await (
      socket.timeout(DEFENSE_JOIN_TIMEOUT_MS) as unknown as {
        emitWithAck(
          eventName: string,
          payload: { scheduleId: string },
        ): Promise<unknown>;
      }
    ).emitWithAck(DEFENSE_JOIN_EVENT, { scheduleId });

    return parseDefenseJoinAck(acknowledgement);
  } catch {
    // Transport timeout/failure: polling/REST remains authoritative.
    return { ok: false, code: "FORBIDDEN" };
  }
}

export function leaveDefenseRoom(socket: Socket): void {
  try {
    socket.emit(DEFENSE_LEAVE_EVENT);
  } catch {
    // Best-effort cleanup only; disconnect is the real room teardown.
  }
}
