import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { defenseAdviserAuthorization, type DefenseAdviserCapability } from "../access/defense-adviser-authorization";
import { AppError } from "../utils/AppError";

export const requireDefenseAdviserCapability = (capability: DefenseAdviserCapability) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try { await defenseAdviserAuthorization.assert(req.user?.userId as string, capability); next(); }
    catch (error) { res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Defense/Adviser administrative access denied." }); }
  };

/** Shared Student routes retain Student authority. Admin branches remain closed pending FACULTY-8/10. */
export const excludeDefenseAdviserAdministration = (shared = false) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!shared || req.user?.role === "ADMIN") defenseAdviserAuthorization.assertExcluded();
      next();
    } catch { res.status(403).json({ error: "This administrative action is not available through Defense/Adviser access." }); }
  };
