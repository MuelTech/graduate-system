import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { PanelistService } from "../services/panelist.service";
import { AppError } from "../utils/AppError";

const panelistService = new PanelistService();

export class PanelistController {
    async toggleAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.userId) {
                res.status(401).json({ error: "Unauthorized!" });
                return;
            }

            const { isAvailable } = req.body;
            const updated = await panelistService.toggleAvailability(req.user.userId, isAvailable);
            res.json(updated);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const panelist = await panelistService.getPanelistByUserId(req.user.userId);

            if (!panelist) {
                res.status(404).json({ error: "Panelist profile not found." });
                return;
            }

            res.json(panelist);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }
}
