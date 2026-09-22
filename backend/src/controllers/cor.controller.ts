import { Response } from "express";
import fs from "fs/promises";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { CorService } from "../services/cor.service";
import { AppError } from "../utils/AppError";

export class CorController {
    private corService = new CorService();

    uploadCor = async (
        req: AuthenticatedRequest,
        res: Response,
    ): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new AppError("Unauthorized", 401);

            if (!req.file) throw new AppError("No file uploaded", 400);

            const upload = await this.corService.uploadCor(userId, req.file);
            res.status(201).json({ message: "COR uploaded successfully", upload });
        } catch (error: unknown) {
            // Cleanup file on any controller-level error
            if (req.file?.path) {
                try { await fs.unlink(req.file.path); } catch { /* ignore */ }
            }
            if (error instanceof AppError)
                res.status(error.statusCode).json({ error: error.message });
            else if (error instanceof Error)
                res.status(400).json({ error: error.message });
            else res.status(500).json({ error: "Unexpected error" });
        }
    };

    getMyUpload = async (
        req: AuthenticatedRequest,
        res: Response,
    ): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) throw new AppError("Unauthorized", 401);

            const uploadStatus = await this.corService.getMyUpload(userId);
            res.status(200).json(uploadStatus);
        } catch (error: unknown) {
            if (error instanceof AppError)
                res.status(error.statusCode).json({ error: error.message });
            else if (error instanceof Error)
                res.status(400).json({ error: error.message });
            else res.status(500).json({ error: "Unexpected error" });
        }
    };

    getPendingUploads = async (
        req: AuthenticatedRequest,
        res: Response,
    ): Promise<void> => {
        try {
            const uploads = await this.corService.getPendingUploads();
            res.status(200).json(uploads);
        } catch (error: unknown) {
            if (error instanceof AppError)
                res.status(error.statusCode).json({ error: error.message });
            else if (error instanceof Error)
                res.status(400).json({ error: error.message });
            else res.status(500).json({ error: "Unexpected error" });
        }
    };

    verifyCor = async (
        req: AuthenticatedRequest,
        res: Response,
    ): Promise<void> => {
        try {
            const adminId = req.user?.userId;
            if (!adminId) throw new AppError("Unauthorized", 401);

            const { id } = req.params;
            const result = await this.corService.verifyCor(
                id as string,
                adminId,
                req.body,
            );
            res.status(200).json({ message: "COR verified successfully", result });
        } catch (error: unknown) {
            if (error instanceof AppError)
                res.status(error.statusCode).json({ error: error.message });
            else if (error instanceof Error)
                res.status(400).json({ error: error.message });
            else res.status(500).json({ error: "Unexpected error" });
        }
    };

    rejectCor = async (
        req: AuthenticatedRequest,
        res: Response,
    ): Promise<void> => {
        try {
            const adminId = req.user?.userId;
            if (!adminId) throw new AppError("Unauthorized", 401);

            const { id } = req.params;
            const { reason } = req.body;
            if (!reason || typeof reason !== "string" || !reason.trim()) {
                throw new AppError("Rejection reason is required.", 400);
            }

            const result = await this.corService.rejectCor(
                id as string,
                adminId,
                reason.trim(),
            );
            res.status(200).json({ message: "COR rejected", result });
        } catch (error: unknown) {
            if (error instanceof AppError)
                res.status(error.statusCode).json({ error: error.message });
            else if (error instanceof Error)
                res.status(400).json({ error: error.message });
            else res.status(500).json({ error: "Unexpected error" });
        }
    };
}
