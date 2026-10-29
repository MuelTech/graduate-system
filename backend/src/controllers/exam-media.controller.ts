import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamMediaService } from "../services/exam-media.service";
import { AppError } from "../utils/AppError";
import type { SecureMulterFile } from "../storage/secure-upload";
import { cleanupRequestUploads, commitRequestUploads } from "../storage/request-uploads";

export class ExamMediaController {
  constructor(private readonly service = new ExamMediaService()) {}

  upload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      if (!req.user) throw new AppError("Unauthorized.", 401);
      if (req.user.role !== "ADMIN") throw new AppError("Forbidden.", 403);
      if (!req.file) throw new AppError("An image is required.", 400);
      const result = await this.service.registerPromotedImage(req.file as SecureMulterFile);
      commitRequestUploads(req);
      res.status(201).json({ id: result.id });
    } catch (error: unknown) {
      await cleanupRequestUploads(req);
      const status = error instanceof AppError ? error.statusCode : 500;
      res.status(status).json({ error: status === 401 ? "Unauthorized." : status === 403 ? "Forbidden." : status === 413 ? "Image exceeds the allowed size." : status === 400 ? "Upload a valid PNG or JPEG image." : "Could not save exam image." });
    }
  };

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
