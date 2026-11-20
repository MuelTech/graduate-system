import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import {
  AdminCapabilityKey,
  sanitizeAdminCapabilities,
} from "../config/admin-capabilities";

import {
  JwtConfigurationError,
  verifyAccessToken,
} from "../utils/jwt";
import { verifyActiveUserSession } from "../services/session-validation.service";

export function isFacultyRole(role?: string | null): boolean {
  return role === "FACULTY" || role === "PANELIST";
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

type AuthenticatedIdentity = NonNullable<AuthenticatedRequest["user"]>;

/**
 * The PR merge result contains main's centralized JWT helper, while this
 * standalone collaborator branch predates it. Resolve the canonical verifier
 * at runtime so optional auth compiles and behaves correctly in both trees.
 */
function loadOptionalAccessTokenVerifier(): (token: string) => AuthenticatedIdentity {
  try {
    const currentJwt = require("../utils/jwt") as {
      verifyAccessToken?: (token: string) => AuthenticatedIdentity;
    };
    if (typeof currentJwt.verifyAccessToken === "function") {
      return currentJwt.verifyAccessToken;
    }
  } catch {
    // Standalone branch fallback below.
  }

  return (token: string): AuthenticatedIdentity => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not defined");
    }

    const decoded = (
      require("jsonwebtoken") as typeof import("jsonwebtoken")
    ).verify(token, secret);

    if (
      typeof decoded === "string" ||
      !decoded ||
      typeof decoded.userId !== "string" ||
      decoded.userId.length === 0 ||
      typeof decoded.role !== "string" ||
      decoded.role.length === 0
    ) {
      throw new Error("Invalid or expired authentication token");
    }

    return { userId: decoded.userId, role: decoded.role };
  };
}

const verifyOptionalAccessToken = loadOptionalAccessTokenVerifier();

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Extracts the token after 'Bearer'

  if (!token) {
    res.status(401).json({ error: "Access denied. No authentication token provided." });
    return;
  }

  let identity: AuthenticatedIdentity;
  try {
    identity = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof JwtConfigurationError) {
      console.error("CRITICAL ERROR: JWT_SECRET environment variable is not defined!");
      res.status(500).json({ error: "Internal Server Error configuration" });
      return;
    }

    res.status(403).json({ error: "Invalid or expired authentication token." });
    return;
  }

  try {
    const sessionCheck = await verifyActiveUserSession(identity);
    if (!sessionCheck.ok) {
      const status =
        sessionCheck.code === "ACCOUNT_DEACTIVATED" ? 403 : 401;
      res.status(status).json({
        error: sessionCheck.error,
        code: sessionCheck.code,
      });
      return;
    }

    req.user = { userId: identity.userId, role: identity.role };
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify active session." });
  }
};

/**
 * Optional authentication: decodes JWT if present in Authorization header,
 * verifies active account/session state, and proceeds unauthenticated without
 * error if absent, invalid, or revoked.
 */
export const optionalAuthenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const identity = verifyOptionalAccessToken(token);
    const sessionCheck = await verifyActiveUserSession(identity);
    if (sessionCheck.ok) {
      req.user = { userId: identity.userId, role: identity.role };
    }
  } catch {
    // Soft ignore for optional authentication.
  }
  next();
};

// Helper to restrict routes based on role (treats FACULTY and PANELIST as equivalent account identities)
export const requireRole = (allowedRoles: string[]) => {
  const expanded = new Set<string>(allowedRoles);
  if (expanded.has("PANELIST") || expanded.has("FACULTY")) {
    expanded.add("PANELIST");
    expanded.add("FACULTY");
  }
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !expanded.has(req.user.role)) {
      res.status(403).json({ error: 'Forbidden. You do not have permissions for this action.' });
      return;
    }
    next();
  };
};

export const requireFullAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden. Administrator access required." });
      return;
    }
    const admin = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isActive: true, role: true, adminAccessLevel: true },
    });
    if (!admin || !admin.isActive || admin.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden. Account is inactive or unauthorized." });
      return;
    }
    if (admin.adminAccessLevel === "RESTRICTED") {
      res.status(403).json({ error: "Forbidden. Full Administrator authority is required." });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify administrator permissions." });
  }
};

export const requireAdminCapability = (capability: AdminCapabilityKey) =>
  requireAnyAdminCapability([capability]);

export const requireAnyAdminCapability = (
  allowedCapabilities: readonly AdminCapabilityKey[],
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res.status(403).json({ error: "Forbidden. Administrator access required." });
        return;
      }
      const admin = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          isActive: true,
          role: true,
          adminAccessLevel: true,
          adminCapabilities: true,
        },
      });
      if (!admin || !admin.isActive || admin.role !== "ADMIN") {
        res.status(403).json({ error: "Forbidden. Account is inactive or unauthorized." });
        return;
      }
      if (admin.adminAccessLevel === "RESTRICTED") {
        const capabilities = sanitizeAdminCapabilities(admin.adminCapabilities);
        if (!allowedCapabilities.some((cap) => capabilities.includes(cap))) {
          res.status(403).json({
            error: "Forbidden. You do not have permission for this administrative module.",
          });
          return;
        }
      }
      next();
    } catch {
      res.status(500).json({ error: "Failed to verify administrator permissions." });
    }
  };
};

export const requireEssayEvaluationAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    if (req.user.role !== "ADMIN" && !isFacultyRole(req.user.role)) {
      res.status(403).json({ error: "Forbidden. You do not have permissions for this action." });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        isActive: true,
        role: true,
        adminAccessLevel: true,
        adminCapabilities: true,
        panelist: {
          select: { isActive: true, canEvaluateEssays: true },
        },
      },
    });
    if (!user || user.isActive === false) {
      res.status(403).json({ error: "Forbidden. Account is inactive." });
      return;
    }
    if (req.user.role === "ADMIN" && user.role === "ADMIN") {
      if (user.adminAccessLevel === "RESTRICTED") {
        const caps = sanitizeAdminCapabilities(user.adminCapabilities);
        if (!caps.includes("exam.records.manage")) {
          res.status(403).json({ error: "Forbidden. Exam Records permission is required." });
          return;
        }
      }
      next();
      return;
    }
    if (
      isFacultyRole(req.user.role) &&
      isFacultyRole(user.role) &&
      user.panelist?.isActive &&
      user.panelist?.canEvaluateEssays
    ) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden. Essay Evaluation access is not enabled for your account." });
  } catch {
    res.status(500).json({ error: "Failed to verify essay evaluation access." });
  }
};
