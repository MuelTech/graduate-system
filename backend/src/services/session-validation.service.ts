import prisma from "../config/database";
import type { AuthenticatedIdentity } from "../utils/jwt";

export type SessionInvalidationCode =
  | "ACCOUNT_DEACTIVATED"
  | "SESSION_INVALIDATED";

export type SessionValidationResult =
  | { ok: true }
  | { ok: false; code: SessionInvalidationCode; error: string };

export interface ActiveSessionUserSnapshot {
  isActive: boolean;
  role: string;
  tokenVersion?: number | null;
  panelist?: {
    isActive: boolean;
  } | null;
}

export function evaluateActiveUserSession(
  identity: AuthenticatedIdentity,
  user: ActiveSessionUserSnapshot | null,
): SessionValidationResult {
  if (!user) {
    return {
      ok: false,
      code: "SESSION_INVALIDATED",
      error: "Session is no longer valid. Please sign in again.",
    };
  }

  if (user.isActive === false) {
    return {
      ok: false,
      code: "ACCOUNT_DEACTIVATED",
      error:
        "This account has been deactivated. Please contact the Administrator.",
    };
  }

  const isFaculty = user.role === "FACULTY" || user.role === "PANELIST";
  if (isFaculty && user.panelist && user.panelist.isActive === false) {
    return {
      ok: false,
      code: "ACCOUNT_DEACTIVATED",
      error: "This Faculty profile is currently inactive.",
    };
  }

  const expectedVersion =
    typeof user.tokenVersion === "number" &&
    Number.isInteger(user.tokenVersion) &&
    user.tokenVersion >= 1
      ? user.tokenVersion
      : 1;
  const presentedVersion =
    typeof identity.tokenVersion === "number" &&
    Number.isInteger(identity.tokenVersion) &&
    identity.tokenVersion >= 1
      ? identity.tokenVersion
      : 1;

  if (presentedVersion !== expectedVersion) {
    return {
      ok: false,
      code: "SESSION_INVALIDATED",
      error: "Your session has ended. Please sign in again.",
    };
  }

  return { ok: true };
}

export async function verifyActiveUserSession(
  identity: AuthenticatedIdentity,
  db: { user: { findUnique: typeof prisma.user.findUnique } } = prisma,
): Promise<SessionValidationResult> {
  const user = await db.user.findUnique({
    where: { id: identity.userId },
    select: {
      isActive: true,
      role: true,
      tokenVersion: true,
      panelist: {
        select: { isActive: true },
      },
    },
  });

  return evaluateActiveUserSession(identity, user);
}
