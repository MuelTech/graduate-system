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
     * DL-2 FIX1 / DL-3 FIX1: atomic upload + required upload audit boundary,
     * serialized per Student by locking the authoritative Student row.
     *
     * The Student-row lock serializes competing submissions for the same
     * applicant, so the existence checks inside the transaction are
     * authoritative: two concurrent uploads cannot both create an active
     * PENDING COR. History (e.g. prior REJECTED rows) is never mutated.
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
            await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${uploadData.studentId} FOR UPDATE`;

            const active = await tx.corUpload.findFirst({
                where: { studentId: uploadData.studentId, status: 'PENDING' },
                select: { id: true },
            });
            if (active) {
                throw new AppError(
                    'You already have a pending COR upload. Please wait for it to be reviewed before uploading a new one.',
                    409,
                );
            }

            const verified = await tx.corUpload.findFirst({
                where: { studentId: uploadData.studentId, status: 'VERIFIED' },
                select: { id: true },
            });
            if (verified) {
                throw new AppError(
                    'Your COR is already verified. A verified COR cannot be replaced.',
                    409,
                );
            }

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

    /** The Student's current/latest submission overall (any status). */
    async getCurrentUploadByStudentId(studentId: string) {
        return prisma.corUpload.findFirst({
            where: { studentId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { id: true, status: true },
        });
    }

    /** DL-4: storage/MIME source for extraction of an exact CorUpload. */
    async getExtractionSource(corUploadId: string) {
        return prisma.corUpload.findUnique({
            where: { id: corUploadId },
            select: {
                id: true,
                storageKey: true,
                storageProvider: true,
                filePath: true,
                detectedMimeType: true,
                originalFilename: true,
            },
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

    /**
     * DL-3 FIX1: only current actionable PENDING submissions are review tasks.
     * A student's latest upload overall must itself be PENDING; stale legacy
     * PENDING rows that are not the current submission are hidden (never
     * deleted or mutated).
     */
    async getPendingUploads() {
        const pendingStudents = await prisma.corUpload.findMany({
            where: { status: 'PENDING' },
            select: { studentId: true },
            distinct: ['studentId'],
        });
        if (pendingStudents.length === 0) return [];

        const studentIds = pendingStudents.map((row) => row.studentId);
        const rows = await prisma.corUpload.findMany({
            where: { studentId: { in: studentIds } },
            select: {
                ...UPLOAD_SELECT,
                student: {
                    select: {
                        id: true,
                        programId: true,
                        program: {
                            select: { id: true, programName: true },
                        },
                        user: { select: { firstName: true, lastName: true, email: true } },
                    },
                },
                extraction: {
                    select: {
                        status: true,
                        method: true,
                        extractorVersion: true,
                        parserVersion: true,
                        processedAt: true,
                        diagnostic: true,
                        suggestions: true,
                    },
                },
            },
            orderBy: [
                { studentId: 'asc' },
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
        });

        const seen = new Set<string>();
        const current: typeof rows = [];
        for (const row of rows) {
            if (seen.has(row.studentId)) continue;
            seen.add(row.studentId);
            if (row.status === 'PENDING') current.push(row);
        }
        return current;
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
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
                corRecord: true,
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
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
     * DL-3 canonical rejection: only the Student's exact current PENDING
     * submission may be rejected. The Student row is locked so a concurrent
     * submission cannot change which row is current mid-transaction. Rejection
     * reason + reviewer + timestamp and the audit entry commit atomically;
     * historical rejected rows/files are never mutated or deleted.
     */
    async rejectUpload(
        corUploadId: string,
        opts: { studentId: string; reason: string; adminId: string },
    ) {
        return prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${opts.studentId} FOR UPDATE`;

            const latest = await tx.corUpload.findFirst({
                where: { studentId: opts.studentId },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                select: { id: true },
            });
            if (!latest || latest.id !== corUploadId) {
                throw new AppError(
                    'Only the current COR submission can be rejected.',
                    409,
                );
            }

            const updated = await tx.corUpload.updateMany({
                where: { id: corUploadId, studentId: opts.studentId, status: 'PENDING' },
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
    /**
     * DL-3 canonical verify + promote. One transaction performs the entire
     * authority transition and required audit.
     *
     * Authority is exact: the Student must be APPLICANT and the account User
     * must be APPLICANT. Any other state (DISQUALIFIED, ENROLLED, wrong role)
     * fails closed and rolls back, including the preliminary COR claim.
     * Conditional writes with affected-row checks prevent concurrent/inconsistent
     * state changes from being overwritten. The Student row is locked so a
     * concurrent submission cannot change which upload is current mid-transaction.
     */
    async verifyAndPromote(
        corUploadId: string,
        studentId: string,
        userId: string,
        verificationData: {
            registrationNumber?: string;
            studentNumber: string;
            firstName: string;
            lastName: string;
            email: string;
            programId: string;
            verificationMethod: string;
        },
        adminId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 0. Serialize per Student (also blocks concurrent upload creation).
            await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${studentId} FOR UPDATE`;

            // 1. The supplied upload must be the Student's current submission.
            const latest = await tx.corUpload.findFirst({
                where: { studentId },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                select: { id: true },
            });
            if (!latest || latest.id !== corUploadId) {
                throw new AppError(
                    'Only the current COR submission can be reviewed.',
                    409,
                );
            }

            // 2. Claim the exact PENDING upload (fail closed if already handled).
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

            // 3. Exact Student authority: must be APPLICANT.
            const student = await tx.student.findUnique({ where: { id: studentId } });
            if (!student) {
                throw new AppError('Student profile not found.', 404);
            }
            if (student.admissionStatus !== 'APPLICANT') {
                throw new AppError(
                    'Only an APPLICANT can be promoted to Student.',
                    409,
                );
            }

            // 4. Entrance exam gate re-checked inside the transaction.
            const passedExam = await tx.entranceExamApplication.findFirst({
                where: { studentId, status: 'PASSED' },
            });
            if (!passedExam) {
                throw new AppError(
                    'Applicant has not passed the entrance exam.',
                    403,
                );
            }

            // 5. Exact account authority: must be APPLICANT.
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new AppError('Applicant account not found.', 404);
            }
            if (user.role !== 'APPLICANT') {
                throw new AppError(
                    'Only an APPLICANT account can be promoted to Student.',
                    409,
                );
            }

            // COR-AUTH-1: the Admin-confirmed Program must still exist. Programs
            // are never created or fuzzy-matched here; selection is Admin-owned.
            const program = await tx.program.findUnique({
                where: { id: verificationData.programId },
                select: { id: true },
            });
            if (!program) {
                throw new AppError(
                    'The selected Program no longer exists. Refresh and try again.',
                    409,
                );
            }

            // 6. Conditional promotion writes (affected-row checks close races).
            const promotedStudent = await tx.student.updateMany({
                where: { id: studentId, admissionStatus: 'APPLICANT' },
                data: {
                    admissionStatus: 'ENROLLED',
                    studentNumber: verificationData.studentNumber,
                    // COR-AUTH-1: Admin-confirmed existing Program.
                    programId: verificationData.programId,
                    // System enrollment/promotion confirmation timing only. It
                    // is NOT official residency start; `residencyStartDate` is
                    // deliberately never assigned from the verification time.
                    enrollmentDate: new Date(),
                },
            });
            if (promotedStudent.count !== 1) {
                throw new AppError(
                    'Applicant state changed. Refresh and try again.',
                    409,
                );
            }

            const promotedUser = await tx.user.updateMany({
                where: { id: userId, role: 'APPLICANT' },
                data: {
                    role: 'STUDENT',
                    // COR-AUTH-1: Admin-confirmed COR identity becomes authoritative.
                    firstName: verificationData.firstName,
                    lastName: verificationData.lastName,
                    email: verificationData.email,
                },
            });
            if (promotedUser.count !== 1) {
                throw new AppError(
                    'Applicant account state changed. Refresh and try again.',
                    409,
                );
            }

            // 7. Verified COR record with Admin-confirmed data.
            const corRecord = await tx.corRecord.create({
                data: {
                    corUploadId,
                    studentId,
                    // COR-5: only the Admin-confirmed Registration Number is
                    // persisted, as a clean nullable value (null when absent).
                    // Academic Year / Semester are not v1 verification authority
                    // and are intentionally left null.
                    registrationNumber:
                        verificationData.registrationNumber?.trim() || null,
                    isAdminVerified: true,
                    verificationMethod: verificationData.verificationMethod as any,
                    verifiedById: adminId,
                    verifiedAt: new Date(),
                },
            });

            // 8. Authoritative audit within the same boundary.
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

            return { corRecord };
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
