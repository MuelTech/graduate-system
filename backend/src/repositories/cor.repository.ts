import prisma from '../config/database';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Fields safe to return to clients — never includes filePath or storageKey
const UPLOAD_SELECT = {
    id: true,
    studentId: true,
    originalFilename: true,
    detectedMimeType: true,
    status: true,
    ocrStatus: true,
    rejectionReason: true,
    reviewedById: true,
    reviewedAt: true,
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

    /**
     * DL-2 FIX1: atomic upload + required upload audit boundary.
     * Either the CorUpload row and its audit record both commit, or neither
     * does — so a committed upload can never be left pointing at a file that
     * request cleanup deleted.
     */
    async createUploadWithAudit(
        uploadData: Prisma.CorUploadUncheckedCreateInput,
        audit: {
            actorId: string | null;
            actionType: string;
            description: string;
            oldValue?: string;
            newValue?: string;
        },
    ) {
        return prisma.$transaction(async (tx) => {
            const upload = await tx.corUpload.create({
                data: uploadData,
                select: UPLOAD_SELECT,
            });

            await tx.auditLog.create({
                data: {
                    actorId: audit.actorId,
                    actionType: audit.actionType,
                    targetTable: "cor_uploads",
                    targetId: upload.id,
                    description: audit.description,
                    oldValue: audit.oldValue ?? null,
                    newValue: audit.newValue ?? null,
                },
            });

            return upload;
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
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
        });
    }

    /** Latest upload of any status — the Applicant's current submission. */
    async getUploadByStudentIdLatest(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            include: {
                corRecord: true,
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
        });
    }

    /** The single current PENDING upload eligible for verify/reject. */
    async getPendingUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: UPLOAD_SELECT,
        });
    }

    async getVerifiedUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId, status: 'VERIFIED' },
            orderBy: { createdAt: 'desc' },
            select: UPLOAD_SELECT,
        });
    }

    /** Full COR submission history (newest first) for authorized Admin views. */
    async getUploadHistoryByStudentId(studentId: string) {
        return prisma.corUpload.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            include: {
                corRecord: true,
                reviewedBy: { select: { firstName: true, lastName: true } },
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

    /**
     * DL-3 canonical rejection: only the exact PENDING upload may be rejected.
     * Rejection reason + reviewer + timestamp are persisted explicitly, with
     * the audit entry committed in the same transaction. Historical rejected
     * rows/files are never mutated or deleted.
     */
    async rejectUpload(
        corUploadId: string,
        opts: { reason: string; adminId: string },
    ) {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.corUpload.updateMany({
                where: { id: corUploadId, status: 'PENDING' },
                data: {
                    status: 'REJECTED',
                    rejectionReason: opts.reason,
                    reviewedById: opts.adminId,
                    reviewedAt: new Date(),
                },
            });

            if (updated.count !== 1) {
                throw new AppError(
                    'Only pending COR uploads can be rejected.',
                    409,
                );
            }

            await tx.auditLog.create({
                data: {
                    actorId: opts.adminId,
                    actionType: 'COR_REJECT',
                    targetTable: 'cor_uploads',
                    targetId: corUploadId,
                    description: `COR rejected: ${opts.reason}`,
                    oldValue: JSON.stringify({ status: 'PENDING' }),
                    newValue: JSON.stringify({
                        status: 'REJECTED',
                        reason: opts.reason,
                    }),
                },
            });

            return { id: corUploadId, status: 'REJECTED' as const };
        });
    }

    async deleteUpload(id: string) {
        return prisma.corUpload.delete({ where: { id } });
    }

    /**
     * DL-3 canonical verify + promote. One transaction performs the entire
     * authority transition and required audit. Concurrency fails closed via
     * the conditional PENDING→VERIFIED update (count must be exactly 1), so a
     * concurrent second verification cannot create a duplicate CorRecord,
     * promote twice, or overwrite the Student Number.
     */
    async verifyAndPromote(
        corUploadId: string,
        studentId: string,
        userId: string,
        verificationData: {
            registrationNumber?: string;
            academicYear?: string;
            semester?: string;
            studentNumber: string;
            verificationMethod: string;
        },
        adminId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 1. Claim the exact PENDING upload (fail closed if already handled).
            const updatedUpload = await tx.corUpload.updateMany({
                where: { id: corUploadId, studentId, status: 'PENDING' },
                data: { status: 'VERIFIED' },
            });

            if (updatedUpload.count !== 1) {
                throw new AppError(
                    'Only a pending COR upload can be verified.',
                    409,
                );
            }

            // 2. Re-check promotion eligibility inside the transaction.
            const student = await tx.student.findUnique({ where: { id: studentId } });
            if (!student) {
                throw new AppError('Student profile not found.', 404);
            }
            if (student.admissionStatus === 'ENROLLED') {
                throw new AppError('Student is already enrolled.', 409);
            }

            const passedExam = await tx.entranceExamApplication.findFirst({
                where: { studentId, status: 'PASSED' },
            });
            if (!passedExam) {
                throw new AppError(
                    'Applicant has not passed the entrance exam.',
                    403,
                );
            }

            // 3. Verified COR record with Admin-confirmed data.
            const corRecord = await tx.corRecord.create({
                data: {
                    corUploadId,
                    studentId,
                    registrationNumber: verificationData.registrationNumber || '',
                    academicYear: verificationData.academicYear,
                    semester: verificationData.semester as any,
                    isAdminVerified: true,
                    verificationMethod: verificationData.verificationMethod as any,
                    verifiedById: adminId,
                    verifiedAt: new Date(),
                },
            });

            // 4. Promote the Student.
            const updatedStudent = await tx.student.update({
                where: { id: studentId },
                data: {
                    admissionStatus: 'ENROLLED',
                    studentNumber: verificationData.studentNumber,
                    enrollmentDate: new Date(),
                    residencyStartDate: new Date(),
                },
            });

            // 5. APPLICANT → STUDENT.
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { role: 'STUDENT' },
            });

            // 6. Authoritative audit within the same boundary.
            await tx.auditLog.create({
                data: {
                    actorId: adminId,
                    actionType: 'COR_VERIFY',
                    targetTable: 'cor_uploads',
                    targetId: corUploadId,
                    description: `COR verified and student enrolled: ${verificationData.studentNumber}`,
                    oldValue: JSON.stringify({ status: 'PENDING' }),
                    newValue: JSON.stringify({
                        status: 'VERIFIED',
                        studentNumber: verificationData.studentNumber,
                    }),
                },
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
