import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('CRITICAL ERROR: JWT_SECRET environment variable is not defined!');
    res.status(500).json({ error: 'Internal Server Error configuration' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
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