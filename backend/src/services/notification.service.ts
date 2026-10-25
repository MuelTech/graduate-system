import { NotificationRepository } from "../repositories/notification.repository";
import { NotificationType } from "@prisma/client";
import type { DefenseScheduleAuditSnapshot } from "./defense-audit";
import { buildDefenseCorrectionNotifications } from "./defense-schedule-notification.rules";

export class NotificationService {
    private repo = new NotificationRepository();

    async getMyNotifications(userId: string) {
        return await this.repo.getByUserId(userId);
    }

    async markAsRead(id: string) {
        return await this.repo.markAsRead(id);
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