import { Request, Response, NextFunction } from "express";

import {
  JwtConfigurationError,
  verifyAccessToken,
} from "../utils/jwt";

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

// Optional helper to restrict routes based on role
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden. You do not have permissions for this action.' });
      return;
    }
    next();
  };
};
