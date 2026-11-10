import { NotificationRepository } from "../repositories/notification.repository";
import { NotificationType } from "@prisma/client";
import type { DefenseScheduleAuditSnapshot } from "./defense-audit";
import { buildDefenseCorrectionNotifications } from "./defense-schedule-notification.rules";
import { AppError } from "../utils/AppError";

export class NotificationService {
    private repo = new NotificationRepository();

    async getMyNotifications(userId: string) {
        return await this.repo.getByUserId(userId);
    }

    async markAsRead(id: string, userId: string) {
        const notificationId = typeof id === "string" ? id.trim() : "";
        if (!notificationId || !userId) {
            throw new AppError("Notification not found.", 404);
        }
        const updated = await this.repo.markAsRead(notificationId, userId);
        if (!updated) {
            throw new AppError("Notification not found.", 404);
        }
        return updated;
    }

    /** Best-effort follow-up after the authoritative correction has committed. */
    async notifyDefenseCorrection(input: {
        studentUserId: string;
        before: DefenseScheduleAuditSnapshot;
        after: DefenseScheduleAuditSnapshot;
    }): Promise<number> {
        const notices = buildDefenseCorrectionNotifications(input);
        if (notices.length === 0) return 0;
        await this.repo.createMany(notices);
        return notices.length;
    }
}