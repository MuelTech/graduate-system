import type { AuthenticatedIdentity } from "../utils/jwt";
import { verifyAccessToken } from "../utils/jwt";

interface DefenseAuthSocket {
  handshake: {
    auth?: unknown;
    query?: unknown;
  };
  data: Record<string, unknown>;
}

type SocketNext = (err?: Error) => void;

export interface DefenseSocketAuthOptions {
  verifyToken?: (token: string) => AuthenticatedIdentity;
}

/**
 * CDW-8A socket handshake authentication.
 *
 * The token is read ONLY from `socket.handshake.auth.token`. URL query tokens
 * and client-supplied identities are ignored. Any missing/invalid/expired
 * token rejects the connection; REST auth remains the authority for session
 * expiry and logout.
 */
export function createDefenseSocketAuthMiddleware(
  options: DefenseSocketAuthOptions = {},
): (socket: DefenseAuthSocket, next: SocketNext) => void {
  const verifyToken = options.verifyToken ?? verifyAccessToken;

  return (socket, next) => {
    const auth = socket.handshake.auth;
    const token =
      auth && typeof auth === "object" && !Array.isArray(auth)
        ? (auth as Record<string, unknown>).token
        : undefined;

    if (typeof token !== "string" || token.length === 0) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    try {
      const identity = verifyToken(token);
      socket.data.userId = identity.userId;
      socket.data.role = identity.role;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  };
}
