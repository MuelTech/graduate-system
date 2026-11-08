import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { FacultyEssayEvaluationService } from "../services/faculty-essay-evaluation.service";
import { ExamMediaService } from "../services/exam-media.service";
import { AppError } from "../utils/AppError";

export class FacultyEssayEvaluationController {
  constructor(private readonly service = new FacultyEssayEvaluationService(), private readonly media = new ExamMediaService()) {}
  private error(res: Response, error: unknown) {
    const status = error instanceof AppError ? error.statusCode : 500;
    res.status(status).json({ error: status === 503 ? "Essay Evaluation is currently unavailable." :
      status < 500 && error instanceof AppError ? error.message : "The Essay Evaluation request could not be completed." });
  }
  queue = async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.json(await this.service.queue(req.user?.userId ?? "", req.query.cursor)); }
    catch (error) { this.error(res, error); }
  };
  detail = async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.json(await this.service.detail(req.params.id as string, req.user?.userId ?? "")); }
    catch (error) { this.error(res, error); }
  };
  grade = async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.json(await this.service.grade(req.params.id as string, req.body, req.user?.userId ?? "")); }
    catch (error) { this.error(res, error); }
  };
  image = async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const image = await this.media.getEssayContent(req.params.mediaId as string, req.params.id as string, req.user?.userId ?? "");
      res.setHeader("Content-Type", image.mimeType); res.setHeader("Content-Length", image.bytes.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `inline; filename="exam-image.${image.mimeType === "image/png" ? "png" : "jpg"}"`);
      res.send(image.bytes);
    } catch (error) { this.error(res, error); }
  };
}
