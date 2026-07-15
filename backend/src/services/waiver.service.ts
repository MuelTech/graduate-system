import { WaiverRepository } from '../repositories/waiver.repository';

export class WaiverService {
    private waiverRepository = new WaiverRepository();

    async getMyWaiver(studentId: string) {
        const waiver = await this.waiverRepository.getWaiverByStudentId(studentId);
        if (!waiver) {
            throw new Error("No bridging waiver record found for this applicant.");
        }

        return waiver;
    }

    async logWaiverDownload(studentId: string) {
        return this.waiverRepository.updateWaiverDownloadedAt(studentId);
    }

    async getAdminQueue() {
        return this.waiverRepository.getAdminWaiverQueue();
    }

    async validateWaiver(waiverId: string, adminId: string) {
        return this.waiverRepository.validateWaiver(waiverId, adminId);
    }

    async rejectWaiver(waiverId: string, adminId: string, notes: string) {
        return this.waiverRepository.rejectWaiver(waiverId, adminId, notes);
    }
}