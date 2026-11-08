import { SettingsRepository, AuditLogQuery } from "../repositories/settings.repository";
import { AppError } from "../utils/AppError";
import { OperationalAuthorization, operationalAuthorization } from "../access/operational-authorization";
import { isOrdinarySettingKey } from "../access/operational-settings-policy";

export class SettingsService {
    private repository = new SettingsRepository();
    constructor(private readonly authorization: OperationalAuthorization = operationalAuthorization) {}

    async getAllSettings(actorId = "") {
        await this.authorization.assert(actorId, "settings.view");
        const rows = await this.repository.getAllSettings(this.authorization.enabled);
        return this.authorization.enabled ? rows.filter(row => isOrdinarySettingKey(row.settingKey)) : rows;
    }

    async updateSetting(settingKey: string, settingValue: string, userId: string) {
        await this.authorization.assert(userId, "settings.manage");
        if (this.authorization.enabled && (!isOrdinarySettingKey(settingKey) || typeof settingValue !== "string")) {
            throw new AppError("This setting cannot be changed here.", 403);
        }
        return this.authorization.write(userId, "settings.manage", tx =>
            (tx ? new SettingsRepository(tx) : this.repository).updateSetting(settingKey, settingValue, userId, this.authorization.enabled));
    }

    async getAllEmailTemplates(actorId = "") {
        await this.authorization.assert(actorId, "email.configuration.manage");
        return this.repository.getAllEmailTemplates();
    }

    async updateEmailTemplate(templateKey: string, subject: string, bodyHtml: string, userId: string) {
        return this.authorization.write(userId, "email.configuration.manage", tx =>
            (tx ? new SettingsRepository(tx) : this.repository).updateEmailTemplate(templateKey, subject, bodyHtml, userId));
    }

    async getAuditLogs(filters: AuditLogQuery, actorId = "") {
        await this.authorization.assert(actorId, "audit.view");
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;

        const [logs, total] = await Promise.all([
            this.repository.getAuditLogs(filters),
            this.repository.countAuditLogs(filters)
        ]);

        return { logs, total, page, pageSize };
    }

    async deleteAuditLog(id: string, _actorId = "") {
        this.authorization.assertExcluded();
        if (typeof id !== "string" || !id.trim() || id.length > 191) throw new AppError("Invalid audit log identifier.", 400);
        const log = await this.repository.deleteAuditLog(id);
        if (!log) {
            throw new AppError("Audit log not found!", 404);
        }
        return { message: "Audit log deleted." };
    }

    async deleteAuditLogs(ids: string[], _actorId = "") {
        this.authorization.assertExcluded();
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 ||
            ids.some(id => typeof id !== "string" || !id.trim() || id.length > 191)) {
            throw new AppError("No audit logs selected!", 400);
        }
        const result = await this.repository.deleteAuditLogs(ids);
        return { message: `${result.count} audit log(s) deleted.`, count: result.count };
    }
}
