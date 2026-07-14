import { NotificationType } from "@prisma/client";
import prisma from "../config/database";

export class NotificationRepository {
    async create(data: {
        userId: string;
        title: string;
        message: string;
        type: NotificationType;
        relatedRecordType?: string;
        relatedRecordId?: string
    }) {
        return await prisma.notification.create({ data });
    }

    async createMany(data: {
        userId: string;
        title: string;
        message: string;
        type: NotificationType;
        relatedRecordType?: string;
        relatedRecordId?: string
    }[]) {
        return await prisma.notification.createMany({ data });
    }

    async getByUserId(userId: string) {
        return await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50, // Limit to recent 50
        });
    }

    async markAsRead(id: string) {
        return await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
    }
}