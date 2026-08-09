import { ApplicantRepository } from '../repositories/applicant.repository';

export class ApplicantService {
    private applicantRepo = new ApplicantRepository();

    async getProfile(userId: string) {
        const student = await this.applicantRepo.getProfileWithRelations(userId);

        if (!student) {
            throw new Error("Applicant profile not found");
        }

        let calculatedStep = 0;

        if (student.alignmentStatus === 'ALIGNED' || student.alignmentStatus === 'CLEARED') calculatedStep = 1;
        if (student.examApplications.length > 0 && student.examApplications[0].status === 'PASSED') calculatedStep = 2;

        return {
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            applicantId: student.pinnacleApplicantId,
            program: student.program.programName,
            alignmentStatus: student.alignmentStatus?.toLowerCase() || 'pending_waiver',
            currentStep: calculatedStep,
            examDate: student.examApplications[0]?.slot?.examDate || null,
            examTime: student.examApplications[0]?.slot?.examTime || null
        };
    }
}
