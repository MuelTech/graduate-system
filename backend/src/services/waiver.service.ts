import { WaiverRepository } from '../repositories/waiver.repository';
import { EmailService } from './email.service';

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
        const waiver = await this.waiverRepository.validateWaiver(waiverId, adminId);

        if ((waiver as any).student?.user?.email) {
            const studentUser = (waiver as any).student.user;
            EmailService.sendTemplateEmail(
                studentUser.email,
                "bridging_waiver_validated",
                {
                    student_name: `${studentUser.firstName} ${studentUser.lastName}`,
                    portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
                }
            ).catch((err) =>
                console.error("[EmailService] Failed to queue bridging_waiver_validated email:", err.message)
            );
        }

        return waiver;
    }

    async rejectWaiver(waiverId: string, adminId: string, notes: string) {
        const waiver = await this.waiverRepository.rejectWaiver(waiverId, adminId, notes);

        if ((waiver as any).student?.user?.email) {
            const studentUser = (waiver as any).student.user;
            EmailService.sendTemplateEmail(
                studentUser.email,
                "bridging_waiver_rejected",
                {
                    student_name: `${studentUser.firstName} ${studentUser.lastName}`,
                    portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
                }
            ).catch((err) =>
                console.error("[EmailService] Failed to queue bridging_waiver_rejected email:", err.message)
            );
        }

        return waiver;
    }
}