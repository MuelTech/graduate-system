import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { SettingsService } from "../services/settings.service";

const settingsService = new SettingsService();

export class SettingsController {
    async getAllSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const settings = await settingsService.getAllSettings();
            res.json(settings);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSetting(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const key = req.params.key as string;
            const { settingValue } = req.body;
            // The exclamation mark tells TypeScript we know req.user exists because of authenticateJWT
            const userId = req.user!.userId;
            const updated = await settingsService.updateSetting(key, settingValue, userId);
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAllEmailTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const templates = await settingsService.getAllEmailTemplates();
            res.json(templates);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateEmailTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const key = req.params.key as string;
            const { subject, bodyHtml } = req.body;
            const userId = req.user!.userId;

            const updated = await settingsService.updateEmailTemplate(key, subject, bodyHtml, userId);
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const logs = await settingsService.getAuditLogs();
            res.json(logs);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}