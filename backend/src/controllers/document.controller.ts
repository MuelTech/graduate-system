// backend/src/controllers/document.controller.ts
import { Response } from "express";
import fs from "fs";
import { DocumentService } from "../services/document.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AppError } from "../utils/AppError";

export class DocumentController {
  private documentService = new DocumentService();

  getFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const modelType = req.params.modelType as string;
      const id = req.params.id as string;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        throw new AppError("Unauthorized", 401);
      }

      const { filePath, mimeType, originalFilename } =
        await this.documentService.resolveDocument(modelType, id, userId, userRole);

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${originalFilename}"`);
      res.setHeader("Cache-Control", "private, no-store");

      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };
}
