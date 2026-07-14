import { NotificationRepository } from "../repositories/notification.repository";
import { NotificationType } from "@prisma/client";

export class NotificationService {
    private repo = new NotificationRepository();

    async getMyNotifications(userId: string) {
        return await this.repo.getByUserId(userId);
    }

    async markAsRead(id: string) {
        return await this.repo.markAsRead(id);
    }
}