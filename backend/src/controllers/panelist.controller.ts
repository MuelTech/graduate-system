import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { PanelistService } from "../services/panelist.service";

const panelistService = new PanelistService();

export class PanelistController {
    async getAllPanelists(req: Request, res: Response) {
        try {
            const panelists = await panelistService.getAllPanelists();
            res.json(panelists);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async createPanelist(req: Request, res: Response) {
        try {
            const panelist = await panelistService.createPanelist(req.body);
            res.status(201).json(panelist);
        } catch (error: any) {
            if (error.message === "Email is already in use by another account.") {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }

    async updatePanelist(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const updated = await panelistService.updatePanelist(id, req.body);
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async toggleAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            // Ensure the user object exist from the JWT token
            if (!req.user || !req.user.userId) {
                res.status(401).json({ error: "Unauthorized!" });
                return;
            }

            const { isAvailable } = req.body;
            const updated = await panelistService.toggleAvailability(req.user.userId, isAvailable);
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}