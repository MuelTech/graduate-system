import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamMediaService } from "../services/exam-media.service";
import { AppError } from "../utils/AppError";

export class ExamMediaController {
  constructor(private readonly service = new ExamMediaService()) {}

  getContent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const content = await this.service.getContent(req.params.mediaId as string, req.user);
      res.setHeader("Content-Type", content.mimeType);
      res.setHeader("Content-Length", content.bytes.length);
      const extension = content.mimeType === "image/png" ? "png" : "jpg";
      res.setHeader("Content-Disposition", `inline; filename="exam-image.${extension}"`);
      res.send(content.bytes);
    } catch (error: unknown) {
      const status = error instanceof AppError ? error.statusCode : 500;
      res.status(status).json({ error: status === 401 ? "Unauthorized." : status === 403 ? "Forbidden." : status === 404 ? "Exam media not found." : "Could not retrieve exam media." });
    }
  };
}
