import { EmailStatus } from "@prisma/client";
import prisma from "../config/database";

export class EmailRepository {
    async createLog(
        data: {
            recipient: string;
            subject: string;
            templateKey?: string;
            status?: EmailStatus;
            errorMessage?: string;
        }
    ) {
        return await prisma.emailLog.create({
            data: {
                recipient: data.recipient,
                subject: data.subject,
                templateKey: data.templateKey,
                status: data.status || "QUEUED",
                errorMessage: data.errorMessage,
            }
        });
    }

    async updateLogStatus(logId: string, status: EmailStatus, errorMessage?: string) {
        return await prisma.emailLog.update({
            where: { id: logId },
            data: {
                status,
                errorMessage,
                sentAt: status === "SENT" ? new Date() : undefined
            }
        });
    }

    async getTemplateByKey(templateKey: string) {
        return await prisma.emailTemplate.findUnique({
            where: { templateKey }
        });
    }

    async getPaginatedLogs(page: number, limit: number) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            prisma.emailLog.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }// Newest first
            }),
            prisma.emailLog.count()
        ]);

        return {
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}