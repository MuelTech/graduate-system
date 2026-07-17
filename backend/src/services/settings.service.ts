import { SettingsRepository, AuditLogQuery } from "../repositories/settings.repository";
import { AppError } from "../utils/AppError";

export class SettingsService {
    private repository = new SettingsRepository();

    async getAllSettings() {
        return this.repository.getAllSettings();
    }

    async updateSetting(settingKey: string, settingValue: string, userId: string) {
        return this.repository.updateSetting(settingKey, settingValue, userId);
    }

    async getAllEmailTemplates() {
        return this.repository.getAllEmailTemplates();
    }

    async updateEmailTemplate(templateKey: string, subject: string, bodyHtml: string, userId: string) {
        this.repository.updateEmailTemplate(templateKey, subject, bodyHtml, userId);
    }

    async getAuditLogs(filters: AuditLogQuery) {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;

        const [logs, total] = await Promise.all([
            this.repository.getAuditLogs(filters),
            this.repository.countAuditLogs(filters)
        ]);

        return { logs, total, page, pageSize };
    }

    async deleteAuditLog(id: string) {
        const log = await this.repository.deleteAuditLog(id);
        if (!log) {
            throw new AppError("Audit log not found!", 404);
        }
        return { message: "Audit log deleted." };
    }

    async deleteAuditLogs(ids: string[]) {
        if (!ids || ids.length === 0) {
            throw new AppError("No audit logs selected!", 400);
        }
        const result = await this.repository.deleteAuditLogs(ids);
        return { message: `${result.count} audit log(s) deleted.`, count: result.count };
    }
}