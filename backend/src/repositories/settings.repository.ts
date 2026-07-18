import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export interface AuditLogQuery {
    page?: number;
    pageSize?: number;
    actionType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
}

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

    async countAuditLogs(filters: AuditLogQuery): Promise<number> {
        const where = this.buildAuditLogWhereClause(filters);
        return prisma.auditLog.count({ where });
    }

    async getAuditLogs(filters: AuditLogQuery) {
        const where = this.buildAuditLogWhereClause(filters);
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const skip = (page - 1) * pageSize;

        return prisma.auditLog.findMany({
            where,
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
            skip,
            take: pageSize
        });
    }

    async deleteAuditLog(id: string) {
        return prisma.auditLog.delete({
            where: { id }
        });
    }

    async deleteAuditLogs(ids: string[]) {
        return prisma.auditLog.deleteMany({
            where: { id: { in: ids } }
        });
    }

    private buildAuditLogWhereClause(filters: AuditLogQuery): Prisma.AuditLogWhereInput {
        const where: Prisma.AuditLogWhereInput = {};

        if (filters.actionType) {
            where.actionType = filters.actionType;
        }

        if (filters.actorId) {
            where.actorId = filters.actorId;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.createdAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
            }
        }

        if (filters.search) {
            where.OR = [
                { description: { contains: filters.search } },
                { actionType: { contains: filters.search } },
                { targetTable: { contains: filters.search } }
            ];
        }

        return where;
    }
}