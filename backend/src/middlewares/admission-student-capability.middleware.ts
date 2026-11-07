import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { admissionStudentAuthorization, type AdmissionStudentCapability } from "../access/admission-student-authorization";
import { AppError } from "../utils/AppError";

/** Follows FACULTY-2 authentication/current ADMIN check; service rechecks independently. */
export const requireAdmissionStudentCapability = (capability: AdmissionStudentCapability) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await admissionStudentAuthorization.assert(req.user?.userId as string, capability);
      next();
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 503)
        .json({ error: "Administrative access denied." });
    }
  };
