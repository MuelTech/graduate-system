import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminPanelistService } from "../services/admin-panelist.service";
import { AppError } from "../utils/AppError";

const adminPanelistService = new AdminPanelistService();

export class AdminPanelistController {
    async getManagementContext(req: AuthenticatedRequest, res: Response) {
        res.setHeader("Cache-Control", "private, no-store");
        try {
            res.json(await adminPanelistService.getManagementContext(req.user?.userId));
        } catch (error: unknown) {
            if (error instanceof AppError) res.status(error.statusCode).json({ error: error.message });
            else res.status(500).json({ error: "Faculty configuration is unavailable." });
        }
    }
    async getAllPanelists(req: AuthenticatedRequest, res: Response) {
        try {
            const panelists = await adminPanelistService.getAllPanelists(req.user?.userId);
            res.json(panelists);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(500).json({ error: "Faculty configuration is unavailable." });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    async getPanelistById(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id as string;
            const panelist = await adminPanelistService.getPanelistById(id, req.user?.userId);
            if (!panelist) {
                res.status(404).json({ error: "Faculty account not found." });
                return;
            }
            res.json(panelist);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(500).json({ error: "Faculty configuration is unavailable." });
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
            res.setHeader("Cache-Control", "private, no-store");
            res.status(201).json(panelist);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(500).json({ error: "Faculty configuration is unavailable." });
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
                res.status(500).json({ error: "Faculty configuration is unavailable." });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }
}
