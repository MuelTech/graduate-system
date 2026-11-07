import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { EXAM_CONFIGURATION_KEY } from '../services/exam-configuration.rules';
import { AppError } from '../utils/AppError';
import { PROTECTED_ACCESS_AUDIT_PREFIXES, isProtectedAccessAuditAction } from '../access/access-audit';

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
            where: { settingKey: { not: EXAM_CONFIGURATION_KEY } },
            orderBy: { settingKey: 'asc' }
        });
    }

    async updateSetting(settingKey: string, settingValue: string, userId: string) {
        // Resolve through the DB's key collation so case/accent aliases cannot
        // bypass the exam-specific validator via the generic string endpoint.
        const current = await prisma.systemSetting.findUnique({ where: { settingKey }, select: { settingKey: true } });
        if (current?.settingKey.toLowerCase() === EXAM_CONFIGURATION_KEY || settingKey.toLowerCase() === EXAM_CONFIGURATION_KEY) {
            throw new AppError("Manage exam configuration from the Exam Question Bank.", 409);
        }
        return prisma.systemSetting.update({
            where: { settingKey, NOT: { settingKey: EXAM_CONFIGURATION_KEY } },
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
        const result = await this.deleteUnprotectedAuditRows([id]);
        if (result.count === 1) return { id };
        const existing = await prisma.auditLog.findUnique({ where: { id }, select: { actionType: true } });
        if (isProtectedAccessAuditAction(existing?.actionType)) {
            throw new AppError("Administrator access audit evidence cannot be deleted.", 403);
        }
        return null;
    }

    async deleteAuditLogs(ids: string[]) {
        return this.deleteUnprotectedAuditRows(ids);
    }

    private async deleteUnprotectedAuditRows(ids: string[]) {
        if (ids.length === 0) return { count: 0 };
        // Literal prefix comparison in the DELETE itself. SQL LIKE/startsWith
        // would treat the namespace underscores as wildcards and retain unrelated actions.
        const exclusions = Prisma.join(PROTECTED_ACCESS_AUDIT_PREFIXES.map(prefix =>
            Prisma.sql`LEFT(action_type, CHAR_LENGTH(${prefix})) <> ${prefix}`), ' AND ');
        const count = await prisma.$executeRaw`DELETE FROM audit_logs WHERE log_id IN (${Prisma.join(ids)}) AND ${exclusions}`;
        return { count };
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
