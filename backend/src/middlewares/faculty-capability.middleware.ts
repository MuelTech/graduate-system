import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { facultyAuthorization } from "../access/faculty-configuration";
import { AppError } from "../utils/AppError";

export const requireFacultyCapability = (key: "faculty.view" | "faculty.manage") =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError("Authentication is required.", 401);
      if (!facultyAuthorization.enabled) throw new AppError("Faculty configuration is not activated.", 503);
      await facultyAuthorization.assert(req.user.userId, key);
      next();
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Faculty configuration is unavailable." });
    }
  };

export const denyFacultySelfAvailability = (_req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (facultyAuthorization.enabled) { res.status(403).json({ error: "Adviser availability is managed by an Administrator." }); return; }
  next();
};
