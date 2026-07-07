import { SettingsRepository } from "../repositories/settings.repository";

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
    async getAuditLogs() {
        return this.repository.getAuditLogs();
    }
}