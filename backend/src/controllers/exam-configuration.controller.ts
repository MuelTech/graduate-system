import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamConfigurationService } from "../services/exam-configuration.service";
import { AppError } from "../utils/AppError";

export class ExamConfigurationController {
  private service = new ExamConfigurationService();

  getCurrent = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.status(200).json(await this.service.getCurrent()); }
    catch (error: unknown) { this.failure(error, res); }
  };

  replaceCurrent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.status(200).json(await this.service.replaceCurrent(req.body, req.user!.userId)); }
    catch (error: unknown) { this.failure(error, res); }
  };

  private failure(error: unknown, res: Response) {
    res.status(error instanceof AppError ? error.statusCode : 500).json({
      error: error instanceof AppError ? error.message : "Could not access exam configuration.",
    });
  }
}
