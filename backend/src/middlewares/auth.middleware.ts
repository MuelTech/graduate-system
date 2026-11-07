import { Request, Response, NextFunction } from "express";
import { JwtConfigurationError, verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { loadCurrentAccount, type CurrentAccount } from "../services/current-account";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string };
  currentAccount?: CurrentAccount;
}

function credentialRecoveryRequest(req: AuthenticatedRequest): boolean {
  // Query strings cannot widen this exact method/path allowlist.
  const path = req.originalUrl?.split("?")[0];
  return (req.method === "GET" && path === "/api/auth/me") ||
    (req.method === "POST" && path === "/api/auth/change-password");
}

export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  delete req.user;
  delete req.currentAccount;
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (!token) {
    res.status(401).json({ error: "Access denied. No authentication token provided." });
    return;
  }
  let userId: string;
  try {
    userId = verifyAccessToken(token).userId;
  } catch (error) {
    res.status(error instanceof JwtConfigurationError ? 500 : 401).json({ error: "Authentication token could not be verified." });
    return;
  }
  try {
    const account = await loadCurrentAccount(userId);
    if (account.mustChangePassword && !credentialRecoveryRequest(req)) {
      res.status(403).json({ error: "Change your password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
      return;
    }
    req.currentAccount = account;
    req.user = { userId: account.id, role: account.role };
  } catch (error) {
    res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Current account access is unavailable." });
    return;
  }
  next();
};

/** Optional public reads get no elevated identity when current authority fails. */
export const optionalAuthenticateJWT = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
  delete req.user;
  delete req.currentAccount;
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (token) {
    try {
      const account = await loadCurrentAccount(verifyAccessToken(token).userId);
      if (!account.mustChangePassword) {
        req.currentAccount = account;
        req.user = { userId: account.id, role: account.role };
      }
    } catch { /* Public authority only. */ }
  }
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden. You do not have permissions for this action." });
      return;
    }
    next();
  };
};
