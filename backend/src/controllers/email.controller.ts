import { Request, Response } from "express";
import { EmailRepository } from "../repositories/email.repository";

const emailRepository = new EmailRepository();

export const emailController = {
    // ADMIN: Fetch the history of sent/failed emails
    async getEmailLogs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const safePage = Math.max(1, page);
            const safeLimit = Math.min(Math.max(1, limit), 100);

            const result = await emailRepository.getPaginatedLogs(safePage, safeLimit);

            res.status(200).json(result);
        } catch (error: any) {
            console.error("[EmailController] Failed to fetch email logs:", error);
            res.status(500).json({ error: "Failed to fetch email logs." });
        }
    }
}