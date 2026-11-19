import prisma from '../config/database';

export class ApplicantRepository {
    async getProfileWithRelations(userId: string) {
        return prisma.student.findUnique({
            where: { userId },
            include: {
                user: true,
                program: true,
                examApplications: {
                    include: { slot: true, score: true, resultDecision: true },
                    where: { status: { notIn: ["RESCHEDULED","CANCELLED"] } },
                    orderBy: [{ createdAt: 'desc' },{ id: 'desc' }]
                }
            }
        });
    }

    async updateContactCellphone(userId: string, cellphone: string) {
        return prisma.$transaction(async (tx) => {
            const existing = await tx.student.findUnique({
                where: { userId },
                select: { id: true, cellphone: true, admissionStatus: true },
            });
            if (!existing) {
                return null;
            }
            const updated = await tx.student.update({
                where: { id: existing.id },
                data: { cellphone },
                select: { id: true, cellphone: true },
            });
            await tx.auditLog.create({
                data: {
                    actorId: userId,
                    actionType: "APPLICANT_CONTACT_UPDATED",
                    targetTable: "students",
                    targetId: existing.id,
                    oldValue: JSON.stringify({ cellphone: existing.cellphone ?? null }),
                    newValue: JSON.stringify({ cellphone }),
                    description: "Applicant updated mobile contact number from Applicant Profile.",
                },
            });
            return updated;
        });
    }
}
