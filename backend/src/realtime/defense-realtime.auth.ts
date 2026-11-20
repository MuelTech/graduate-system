import type { AuthenticatedIdentity } from "../utils/jwt";
import { verifyAccessToken } from "../utils/jwt";
import type { SessionValidationResult } from "../services/session-validation.service";

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
  verifyActiveSession?: (
    identity: AuthenticatedIdentity,
  ) => Promise<SessionValidationResult> | SessionValidationResult;
}

/**
 * CDW-8A socket handshake authentication.
 *
 * The token is read ONLY from `socket.handshake.auth.token`. URL query tokens
 * and client-supplied identities are ignored. Any missing/invalid/expired
 * token or deactivated/revoked account session rejects the connection.
 */
export function createDefenseSocketAuthMiddleware(
  options: DefenseSocketAuthOptions = {},
): (socket: DefenseAuthSocket, next: SocketNext) => void {
  const verifyToken = options.verifyToken ?? verifyAccessToken;
  const verifyActiveSession = options.verifyActiveSession;

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

    let identity: AuthenticatedIdentity;
    try {
      identity = verifyToken(token);
    } catch {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    if (!verifyActiveSession) {
      socket.data.userId = identity.userId;
      socket.data.role = identity.role;
      next();
      return;
    }

    Promise.resolve(verifyActiveSession(identity))
      .then((result) => {
        if (!result.ok) {
          next(new Error(result.code));
          return;
        }
        socket.data.userId = identity.userId;
        socket.data.role = identity.role;
        next();
      })
      .catch(() => {
        next(new Error("UNAUTHORIZED"));
      });
  };
}
