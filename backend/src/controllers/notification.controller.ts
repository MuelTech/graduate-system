import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { AppError } from "../utils/AppError";

export class NotificationController {
    private service = new NotificationService();

    getMyNotifications = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const notifications = await this.service.getMyNotifications(userId);
            res.json(notifications);
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: "Failed to load notifications." });
        }
    };

    markAsRead = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const id = req.params.id as string;
            const notification = await this.service.markAsRead(id, userId);
            res.json(notification);
        } catch (error: any) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
                return;
            }
            res.status(500).json({ error: "Failed to update notification." });
        }
    };
}