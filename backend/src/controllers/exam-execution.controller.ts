import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamExecutionRepository } from "../repositories/exam-execution.repository";
import { AppError } from "../utils/AppError";

export class ExamExecutionController {
  private repo = new ExamExecutionRepository();
  private handle = (operation: (req: AuthenticatedRequest) => Promise<unknown>, mutation = false) => async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (mutation && req.body !== undefined && (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) {
        throw new AppError("This action accepts no configuration or timing fields.", 400);
      }
      res.json(await operation(req));
    } catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not access the examination record." });
    }
  };
  current = this.handle(req => this.repo.current(req.user!.userId));
  read = this.handle(req => this.repo.read(req.user!.userId, req.params.applicationId as string));
  start = this.handle(req => this.repo.start(req.user!.userId, req.params.applicationId as string), true);
  adminRead = this.handle(req => this.repo.adminRead(req.params.applicationId as string, req.user!.userId));
  authorize = this.handle(req => this.repo.authorize(req.user!.userId, req.params.applicationId as string), true);
}
