import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { privateRecordAuthorization, type PrivateRecordCapability } from "../access/private-record-authorization";
import { AppError } from "../utils/AppError";

/** Context/ownership is checked again by the owning service. */
export const requirePrivateRecordCapability = (capabilities: readonly PrivateRecordCapability[], shared = false) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError("Authentication is required.", 401);
      const actor = await privateRecordAuthorization.current(req.user);
      if (!shared || actor.role === "ADMIN") {
        let allowed = false;
        for (const key of capabilities) if (await privateRecordAuthorization.can(actor, key)) { allowed = true; break; }
        if (!allowed) throw new AppError("Administrative capability is required.", 403);
      }
      next();
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Private record access denied." });
    }
  };
