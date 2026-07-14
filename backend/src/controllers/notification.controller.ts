import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
    private service = new NotificationService();

    getMyNotifications = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.userId;
            const notifications = await this.service.getMyNotifications(userId);
            res.json(notifications);
        } catch(error: any) {
            res.status(500).json({ error: error.message });
        }
    };

    markAsRead = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const notification = await this.service.markAsRead(id);
            res.json(notification);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };
}