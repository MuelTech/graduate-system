import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { examAdministrationAuthorization, type ExamAdministrationCapability } from "../access/exam-administration-authorization";
import { AppError } from "../utils/AppError";

export const requireExamAdministrationCapability = (capability: ExamAdministrationCapability, applicantMedia = false) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(applicantMedia && req.user?.role === "APPLICANT")) {
        await examAdministrationAuthorization.assert(req.user?.userId as string, capability);
      }
      next();
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Examination administrative access denied." });
    }
  };

export const excludeExamAdministrationAction = (action: "ESSAY_EVALUATION" | "RESULT_EMAIL") =>
  (_req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try { examAdministrationAuthorization.assertExcluded(action); next(); }
    catch { res.status(403).json({ error: "This action is unavailable through Exam Administration." }); }
  };
