import prisma from '../config/database';

export class ApplicantService {
    async getProfile(userId: string) {
        // Fetch the student profile along with related program and exam data
        const student = await prisma.student.findUnique({
            where: { userId },
            include: {
                user: true,
                program: true,
                bridgingWaiver: true,
                examApplications: {
                    include: { slot: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!student) {
            throw new Error("Applicant profile not found");
        }

        // Return the exact structure the frontend expects!
        return {
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            applicantId: student.pinnacleApplicantId,
            program: student.program.programName,
            alignmentStatus: student.alignmentStatus?.toLowerCase() || 'pending_waiver',
            currentStep: student.examApplications.length > 0 ? 2 : 1, // Step 2 if they scheduled an exam
            examDate: student.examApplications[0]?.slot?.examDate || null,
            examTime: student.examApplications[0]?.slot?.examTime || null,
            strikeCount: student.examApplications[0]?.strikeCount || 0
        };
    }
}
