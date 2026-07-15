import prisma from "../config/database";
import { AlignmentStatus, BridgingWaiverStatus } from "@prisma/client";

export class WaiverRepository {
    async getWaiverByStudentId(studentId: string) {
        return prisma.applicantBridgingWaiver.findUnique({
            where: { studentId },
            include: {
                intendedProgram: true,
                undergraduateProgram: true,
            },
        });
    }

    async updateWaiverDownloadedAt(studentId: string) {
        return prisma.applicantBridgingWaiver.update({
            where: { studentId },
            data: { waiverFormDownloadedAt: new Date() },
        });
    }

    async getAdminWaiverQueue() {
        return prisma.applicantBridgingWaiver.findMany({
            include: {
                student: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            },
                        },
                    },
                },
                intendedProgram: true,
                undergraduateProgram: true,
                validatedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                    }
                }
            },
            orderBy: [
                { status: 'asc' }, //PENDING first
                { createdAt: 'desc' },
            ],
        });
    }

    async validateWaiver(waiverId: string, adminId: string) {
        return prisma.$transaction(async (tx) => {
            const waiver = await tx.applicantBridgingWaiver.update({
                where: { id: waiverId },
                data: {
                    status: BridgingWaiverStatus.VALIDATED,
                    validatedById: adminId,
                    validatedAt: new Date(),
                    adminNotes: "Validated by Admin",
                },
            });

            await tx.student.update({
                where: { id: waiver.studentId },
                data: {
                    alignmentStatus: AlignmentStatus.CLEARED,
                },
            });

            return waiver;
        });
    }

    async rejectWaiver(waiverId: string, adminId: string, notes: string) {
        return prisma.applicantBridgingWaiver.update({
            where: { id: waiverId },
            data: {
                status: BridgingWaiverStatus.REJECTED,
                validatedById: adminId,
                validatedAt: new Date(),
                adminNotes: notes,
            },
        });
    }
}