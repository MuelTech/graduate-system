import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamQuestionSetRepository } from "../repositories/exam-question-set.repository";
import { AppError } from "../utils/AppError";

export class ExamQuestionSetController {
  private repo = new ExamQuestionSetRepository();
  private async respond(res: Response, action: () => Promise<unknown>) {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.status(200).json(await action()); }
    catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not access the Question Set." });
    }
  }
  getCurrent = (req: AuthenticatedRequest, res: Response) => this.respond(res, () => this.repo.getCurrent(req.user!.userId));
  replaceSelection = (req: AuthenticatedRequest, res: Response) => this.respond(res, () => this.repo.replaceSelection(req.body, req.user!.userId));
  publish = (req: AuthenticatedRequest, res: Response) => this.respond(res, () => this.repo.publish(req.body, req.user!.userId));
}
