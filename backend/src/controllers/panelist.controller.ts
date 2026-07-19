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

    async getPanelistById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const panelist = await panelistService.getPanelistById(id);
            if (!panelist) {
                res.status(404).json({ error: "Panelist not found" });
                return;
            }
            res.json(panelist);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async createPanelist(req: AuthenticatedRequest, res: Response) {
        try {
            const adminId = req.user?.userId;
            if (!adminId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const panelist = await panelistService.createPanelist(req.body, adminId);
            res.status(201).json(panelist);
        } catch (error: any) {
            if (error.message === "Email is already in use by another account.") {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }

    async updatePanelist(req: AuthenticatedRequest, res: Response) {
        try {
            const adminId = req.user?.userId;
            if (!adminId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const id = req.params.id as string;
            const updated = await panelistService.updatePanelist(id, req.body, adminId);
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async toggleAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
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
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}