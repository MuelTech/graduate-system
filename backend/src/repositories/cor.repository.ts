import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Fields safe to return to clients — never includes filePath
const UPLOAD_SELECT = {
    id: true,
    studentId: true,
    originalFilename: true,
    detectedMimeType: true,
    status: true,
    ocrStatus: true,
    uploadedAt: true,
    createdAt: true,
} as const;

export class CorRepository {
    async createUpload(data: Prisma.CorUploadUncheckedCreateInput) {
        return prisma.corUpload.create({
            data,
            select: UPLOAD_SELECT,
        });
    }

    async getUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            select: UPLOAD_SELECT,
        });
    }

    async getActiveUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: {
                studentId,
                status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
            select: UPLOAD_SELECT,
        });
    }

    async getPendingUploads() {
        return prisma.corUpload.findMany({
            where: { status: 'PENDING', corRecord: null },
            select: {
                ...UPLOAD_SELECT,
                student: {
                    select: {
                        id: true,
                        programId: true,
                        user: { select: { firstName: true, lastName: true, email: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getUploadById(id: string) {
        return prisma.corUpload.findUnique({
            where: { id },
            include: {
                student: {
                    include: { user: true },
                },
            },
        });
    }

    async getUploadFilePath(id: string): Promise<string | null> {
        const record = await prisma.corUpload.findUnique({
            where: { id },
            select: { filePath: true },
        });
        return record?.filePath ?? null;
    }

    async updateUploadStatus(id: string, status: 'VERIFIED' | 'REJECTED') {
        return prisma.corUpload.update({
            where: { id },
            data: { status },
            select: UPLOAD_SELECT,
        });
    }

    async deleteUpload(id: string) {
        return prisma.corUpload.delete({ where: { id } });
    }

    async verifyAndPromote(
        corUploadId: string,
        studentId: string,
        userId: string,
        verificationData: {
            registrationNumber?: string;
            academicYear?: string;
            semester?: string;
            studentNumber?: string;
        },
        adminId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 1. Mark upload as verified
            const updatedUpload = await tx.corUpload.updateMany({
                where: { id: corUploadId, studentId, status: 'PENDING' },
                data: { status: 'VERIFIED' },
            });

            if (updatedUpload.count !== 1) {
                throw new Error('Only a pending COR upload can be verified.');
            }

            // 2. Create the CorRecord as verified
            const corRecord = await tx.corRecord.create({
                data: {
                    corUploadId,
                    studentId,
                    registrationNumber: verificationData.registrationNumber || '',
                    academicYear: verificationData.academicYear,
                    semester: verificationData.semester as any,
                    isAdminVerified: true,
                    verifiedById: adminId,
                    verifiedAt: new Date(),
                },
            });

            // 3. Promote the Student
            const updatedStudent = await tx.student.update({
                where: { id: studentId },
                data: {
                    admissionStatus: 'ENROLLED',
                    studentNumber: verificationData.studentNumber,
                    enrollmentDate: new Date(),
                    residencyStartDate: new Date(),
                },
            });

            // 4. Update User Role
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { role: 'STUDENT' },
            });

            return { corRecord, updatedStudent, updatedUser };
        });
    }

    async findStudentByUserId(userId: string) {
        return prisma.student.findUnique({ where: { userId } });
    }

    async checkPassedExam(studentId: string) {
        return prisma.entranceExamApplication.findFirst({
            where: { studentId, status: 'PASSED' },
        });
    }

    async checkVerifiedRecord(corUploadId: string) {
        return prisma.corRecord.findFirst({
            where: { corUploadId, isAdminVerified: true },
        });
    }

    async createAuditLog(
        actorId: string | null,
        actionType: string,
        targetId: string,
        description: string,
        oldValue?: string,
        newValue?: string
    ) {
        return prisma.auditLog.create({
            data: {
                actorId,
                actionType,
                targetTable: 'cor_uploads',
                targetId,
                description,
                oldValue: oldValue || null,
                newValue: newValue || null,
            },
        });
    }
}
