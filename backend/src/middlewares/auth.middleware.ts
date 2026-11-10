import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AdminCapabilityKey } from "../config/admin-capabilities";

import {
  JwtConfigurationError,
  verifyAccessToken,
} from "../utils/jwt";

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

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Extracts the token after 'Bearer'

  if (!token) {
    res.status(401).json({ error: 'Access denied. No authentication token provided.' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof JwtConfigurationError) {
      console.error('CRITICAL ERROR: JWT_SECRET environment variable is not defined!');
      res.status(500).json({ error: 'Internal Server Error configuration' });
      return;
    }

    res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
};

/**
 * Optional authentication: decodes JWT if present in Authorization header,
 * but proceeds unauthenticated without error if absent or invalid.
 */
export const optionalAuthenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    req.user = verifyOptionalAccessToken(token);
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

export const requireAdminCapability = (capability: AdminCapabilityKey) => {
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
        const capabilities = Array.isArray(admin.adminCapabilities)
          ? (admin.adminCapabilities as string[])
          : [];
        if (!capabilities.includes(capability)) {
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
    if (!user || !user.isActive) {
      res.status(403).json({ error: "Forbidden. Account is inactive." });
      return;
    }
    if (user.role === "ADMIN") {
      if (user.adminAccessLevel === "RESTRICTED") {
        const caps = Array.isArray(user.adminCapabilities)
          ? (user.adminCapabilities as string[])
          : [];
        if (!caps.includes("exam.records.manage")) {
          res.status(403).json({ error: "Forbidden. Exam Records permission is required." });
          return;
        }
      }
      next();
      return;
    }
    if (isFacultyRole(user.role) && user.panelist?.isActive && user.panelist?.canEvaluateEssays) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden. Essay Evaluation access is not enabled for your account." });
  } catch {
    res.status(500).json({ error: "Failed to verify essay evaluation access." });
  }
};
