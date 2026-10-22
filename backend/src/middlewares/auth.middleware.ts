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

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      role: string;
    };
    req.user = decoded;
  } catch (err) {
    // Soft ignore for optional auth
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
