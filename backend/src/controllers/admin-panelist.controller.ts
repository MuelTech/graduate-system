import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminPanelistService } from "../services/admin-panelist.service";
import { AppError } from "../utils/AppError";

const adminPanelistService = new AdminPanelistService();

export class AdminPanelistController {
    async getAllPanelists(req: Request, res: Response) {
        try {
            const panelists = await adminPanelistService.getAllPanelists();
            res.json(panelists);
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

    async getPanelistById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const panelist = await adminPanelistService.getPanelistById(id);
            if (!panelist) {
                res.status(404).json({ error: "Panelist not found" });
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

    async createPanelist(req: AuthenticatedRequest, res: Response) {
        try {
            const adminId = req.user?.userId;
            if (!adminId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const panelist = await adminPanelistService.createPanelist(req.body, adminId);
            res.status(201).json(panelist);
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

    async updatePanelist(req: AuthenticatedRequest, res: Response) {
        try {
            const adminId = req.user?.userId;
            if (!adminId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const id = req.params.id as string;
            const updated = await adminPanelistService.updatePanelist(id, req.body, adminId);
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
}
