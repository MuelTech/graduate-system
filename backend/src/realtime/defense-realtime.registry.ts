import type { DefenseRealtimeServer } from "./defense-realtime.server";

/**
 * Runtime registry for the initialized defense realtime server.
 *
 * This module deliberately has no runtime import of the Socket.IO server or
 * Prisma, so application/controller code can import the best-effort publisher
 * (and tests can import controllers) without constructing the transport or
 * opening a database connection. The type-only import is erased at runtime.
 */
let activeServer: DefenseRealtimeServer | null = null;

export function setDefenseRealtimeServer(
  server: DefenseRealtimeServer | null,
): void {
  activeServer = server;
}

export function getDefenseRealtimeServer(): DefenseRealtimeServer | null {
  return activeServer;
}

/**
 * Best-effort disconnection of all active defense Socket.IO connections for a
 * user whose account was deactivated or whose credentials/session were revoked.
 * Safe no-op when the realtime server is not running.
 */
export async function disconnectUserDefenseSockets(
  userId: string,
  reason: "ACCOUNT_DEACTIVATED" | "SESSION_INVALIDATED" = "SESSION_INVALIDATED",
): Promise<number> {
  if (!activeServer || !userId) {
    return 0;
  }
  try {
    return await activeServer.disconnectUser(userId, reason);
  } catch {
    return 0;
  }
}
