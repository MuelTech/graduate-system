import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { SettingsService } from "../services/settings.service";
import { AppError } from "../utils/AppError";

const settingsService = new SettingsService();

export class SettingsController {
    async getAllSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const settings = await settingsService.getAllSettings();
            res.json(settings);
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

    async updateSetting(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const key = req.params.key as string;
            const { settingValue } = req.body;
            const userId = req.user!.userId;
            const updated = await settingsService.updateSetting(key, settingValue, userId);
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

    async getAllEmailTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const templates = await settingsService.getAllEmailTemplates();
            res.json(templates);
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

    async updateEmailTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const key = req.params.key as string;
            const { subject, bodyHtml } = req.body;
            const userId = req.user!.userId;

            const updated = await settingsService.updateEmailTemplate(key, subject, bodyHtml, userId);
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

    async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const filters = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
                actionType: (req.query.actionType as string) || "",
                actorId: (req.query.actorId as string) || "",
                startDate: (req.query.startDate as string) || "",
                endDate: (req.query.endDate as string) || "",
                search: (req.query.search as string) || ""
            };
            const result = await settingsService.getAuditLogs(filters);
            res.json(result);
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

    async deleteAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const id = req.params.id as string;
            const result = await settingsService.deleteAuditLog(id);
            res.json(result);
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

    async deleteAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { ids } = req.body;
            const result = await settingsService.deleteAuditLogs(ids);
            res.json(result);
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