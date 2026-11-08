import { Response } from "express";
import { EmailLogService } from "../services/email-log.service";
import { AppError } from "../utils/AppError";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";

const emailLogs = new EmailLogService();

export const emailController = {
    // ADMIN: Fetch the history of sent/failed emails
    async getEmailLogs(req: AuthenticatedRequest, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const safePage = Math.max(1, page);
            const safeLimit = Math.min(Math.max(1, limit), 100);

            const result = await emailLogs.getLogs(req.user!.userId, safePage, safeLimit);

            res.status(200).json(result);
        } catch (error: any) {
            console.error("[EmailController] Failed to fetch email logs:", error);
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: "Failed to fetch email logs." });
        }
    }
}
