import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import type { CapabilityKey } from "../access/capability-catalog";
import { operationalAuthorization } from "../access/operational-authorization";
import { AppError } from "../utils/AppError";

/** Undefined is the dashboard's valid current Admin, with an optionally empty projection. */
export const requireOperationalCapability = (key?: CapabilityKey, shared = false) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError("Authentication is required.", 401);
      if (shared && req.user.role !== "ADMIN") await operationalAuthorization.current(req.user);
      else if (key) await operationalAuthorization.assert(req.user.userId, key);
      else await operationalAuthorization.capabilities(req.user.userId);
      next();
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Administrative access denied." });
    }
  };

export const excludeOperationalAction = (_req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try { operationalAuthorization.assertExcluded(); next(); }
  catch { res.status(403).json({ error: "This administrative action is unavailable." }); }
};
