import { admissionStudentAuthorization } from "../access/admission-student-authorization";
import { WaiverRepository } from '../repositories/waiver.repository';

export class WaiverService {
    constructor(private readonly access = admissionStudentAuthorization) {}
    private waiverRepository = new WaiverRepository(this.access);

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

    async getAdminQueue(actorId: string) {
        await this.access.assert(actorId, "waivers.view");
        return this.waiverRepository.getAdminWaiverQueue();
    }

    async validateWaiver(waiverId: string, adminId: string) {
        await this.access.assert(adminId, "waivers.manage");
        return this.waiverRepository.validateWaiver(waiverId, adminId);
    }

    async rejectWaiver(waiverId: string, adminId: string, notes: string) {
        await this.access.assert(adminId, "waivers.manage");
        return this.waiverRepository.rejectWaiver(waiverId, adminId, notes);
    }
}