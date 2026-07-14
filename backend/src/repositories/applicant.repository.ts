import prisma from '../config/database';

export class ApplicantRepository {
    async getProfileWithRelations(userId: string) {
        return prisma.student.findUnique({
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
    }
}
