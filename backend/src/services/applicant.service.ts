import { ApplicantRepository } from '../repositories/applicant.repository';

export class ApplicantService {
    private applicantRepo = new ApplicantRepository();

    async getProfile(userId: string) {
        // Look how much cleaner this is! The DB logic is completely isolated.
        const student = await this.applicantRepo.getProfileWithRelations(userId);

        if (!student) {
            throw new Error("Applicant profile not found");
        }

        return {
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            applicantId: student.pinnacleApplicantId,
            program: student.program.programName,
            alignmentStatus: student.alignmentStatus?.toLowerCase() || 'pending_waiver',
            currentStep: student.examApplications.length > 0 ? 2 : 1,
            examDate: student.examApplications[0]?.slot?.examDate || null,
            examTime: student.examApplications[0]?.slot?.examTime || null
        };
    }
}
