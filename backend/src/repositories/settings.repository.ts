import prisma from '../config/database';

export class SettingsRepository {
    async getAllSettings() {
        return prisma.systemSetting.findMany({
            orderBy: { settingKey: 'asc' }
        });
    }

    async updateSetting(settingKey: string, settingValue: string, userId: string) {
        return prisma.systemSetting.update({
            where: { settingKey },
            data: { settingValue, lastModifiedById: userId }
        });
    }

    async getAllEmailTemplates() {
        return prisma.emailTemplate.findMany({
            orderBy: { templateKey: 'asc' }
        });
    }

    async updateEmailTemplate(templateKey: string, subject: string, bodyHtml: string, userId: string) {
        return prisma.emailTemplate.update({
            where: { templateKey },
            data: { subject, bodyHtml, updatedById: userId }
        });
    }

    async getAuditLogs() {
        return prisma.auditLog.findMany({
            include: {
                actor: {
                    select: {
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to 100 logs for performance
        });
    }
}