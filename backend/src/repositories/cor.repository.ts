import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class CorRepository {
    async createUpload(data: Prisma.CorUploadUncheckedCreateInput) {
        return prisma.corUpload.create({ data });
    }

    async getUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getPendingUploads() {
        return prisma.corUpload.findMany({
            where: { corRecord: null }, // Uploads with no corresponding verified CorRecord
            include: { student: { include: { user: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getUploadById(id: string) {
        return prisma.corUpload.findUnique({
            where: { id },
            include: { student: { include: { user: true } } }
        });
    }

    async verifyAndPromote(
        corUploadId: string,
        studentId: string,
        userId: string,
        verificationData: any,
        adminId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 1. Create the CorRecord as verified
            const corRecord = await tx.corRecord.create({
                data: {
                    corUploadId,
                    studentId,
                    registrationNumber: verificationData.registrationNumber || '',
                    academicYear: verificationData.academicYear,
                    semester: verificationData.semester,
                    isAdminVerified: true,
                    verifiedById: adminId,
                    verifiedAt: new Date()
                }
            });

            // 2. Promote the Student
            const updatedStudent = await tx.student.update({
                where: { id: studentId },
                data: {
                    admissionStatus: 'ENROLLED',
                    studentNumber: verificationData.studentNumber,
                    enrollmentDate: new Date(),
                    residencyStartDate: new Date()
                }
            });

            // 3. Update User Role
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { role: 'STUDENT' }
            });

            return { corRecord, updatedStudent, updatedUser };
        });
    }

    async findStudentByUserId(userId: string) {
        return prisma.student.findUnique({ where: { userId }});
    }

    async checkPassedExam(studentId: string) {
        return prisma.entranceExamApplication.findFirst({
            where: { studentId, status: "PASSED" }
        });
    }

    async checkVerifiedRecord(corUploadId: string) {
        return prisma.corRecord.findFirst({
            where: { corUploadId, isAdminVerified: true }
        });
    }
}
