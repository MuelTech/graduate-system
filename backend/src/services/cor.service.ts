import fs from "fs/promises";
import { fileTypeFromFile } from "file-type";
import { CorRepository } from "../repositories/cor.repository";
import { AppError } from "../utils/AppError";
import { EmailService } from "./email.service";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_SEMESTERS = ["FIRST_SEM", "SECOND_SEM", "SUMMER"];
/** DL-3: human Admin verification is the only promotion authority. */
const CANONICAL_VERIFICATION_METHOD = "ADMIN_MANUAL";

interface ManagedFile extends Express.Multer.File {
  storageMeta?: {
    storageKey: string;
    storageProvider: string;
    originalFilename: string;
    verifiedMimeType: string | null;
    sizeBytes: number;
    checksum: string;
    checksumAlgorithm: string;
  };
}

interface VerifyCorData {
  studentNumber?: string;
  academicYear?: string;
  semester?: string;
  registrationNumber?: string;
  /** Compatibility aliases accepted from legacy callers. */
  verificationMethod?: string;
  method?: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export class CorService {
    private corRepository = new CorRepository();

    /**
     * DL-2/DL-3: the file is already validated, checksummed and promoted to a
     * managed storage key by the secure upload middleware. This method owns the
     * Applicant upload gates and persists the managed metadata. It must NOT
     * rename the promoted object: `storageKey` must keep resolving to the exact
     * physical object.
     */
    async uploadCor(userId: string, file: Express.Multer.File) {
        const student = await this.corRepository.findStudentByUserId(userId);
        if (!student) {
            await this.safeDeleteFile(file.path);
            throw new AppError("Student profile not found.", 404);
        }

        const hasPassedExam = await this.corRepository.checkPassedExam(student.id);
        if (!hasPassedExam) {
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "You must pass the entrance exam before uploading your COR.",
                403,
            );
        }

        // VERIFIED is terminal — an applicant cannot replace a verified COR.
        const verifiedUpload = await this.corRepository.getVerifiedUploadByStudentId(student.id);
        if (verifiedUpload) {
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "Your COR is already verified. A verified COR cannot be replaced.",
                409,
            );
        }

        // Prevent duplicate active uploads. A REJECTED upload does not block.
        const activeUpload = await this.corRepository.getActiveUploadByStudentId(student.id);
        if (activeUpload) {
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "You already have a pending COR upload. Please wait for it to be reviewed before uploading a new one.",
                409,
            );
        }

        const managed = file as ManagedFile;
        const meta = managed.storageMeta;

        // Prefer DL-2 verified MIME; fall back to byte detection for legacy
        // direct-service calls. Never trust client MIME.
        let detectedMime: string | undefined = meta?.verifiedMimeType ?? undefined;
        if (!detectedMime) {
            try {
                detectedMime = (await fileTypeFromFile(file.path))?.mime;
            } catch {
                detectedMime = undefined;
            }
        }
        if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "Invalid file content. Only PDF, JPEG, and PNG files are allowed.",
                400,
            );
        }

        try {
            const upload = await this.corRepository.createUploadWithAudit(
                {
                    studentId: student.id,
                    filePath: file.path,
                    storageKey: meta?.storageKey ?? null,
                    storageProvider: meta?.storageProvider ?? null,
                    originalFilename: meta?.originalFilename ?? file.originalname,
                    detectedMimeType: detectedMime,
                    sizeBytes: meta?.sizeBytes ?? null,
                    checksum: meta?.checksum ?? null,
                    checksumAlgorithm: meta?.checksumAlgorithm ?? null,
                    uploadedById: userId,
                    status: "PENDING" as const,
                    uploadedAt: new Date(),
                },
                {
                    actorId: userId,
                    actionType: "COR_UPLOAD",
                    description: `COR uploaded by applicant: ${meta?.originalFilename ?? file.originalname}`,
                    newValue: JSON.stringify({
                        originalFilename: meta?.originalFilename ?? file.originalname,
                        detectedMimeType: detectedMime,
                    }),
                },
            );

            return upload;
        } catch (error) {
            // Cleanup file if the atomic upload persistence rolls back
            await this.safeDeleteFile(file.path);
            throw error;
        }
    }

    async getMyUpload(userId: string) {
        const student = await this.corRepository.findStudentByUserId(userId);
        if (!student) throw new AppError("Student profile not found.", 404);

        const upload = await this.corRepository.getUploadByStudentIdLatest(student.id);
        if (!upload) return null;

        const status = String(upload.status).toUpperCase();
        return {
            id: upload.id,
            originalFilename: upload.originalFilename,
            createdAt: upload.createdAt,
            uploadedAt: upload.uploadedAt,
            status,
            isVerified: status === "VERIFIED",
            rejectionReason: upload.rejectionReason ?? null,
            reviewedAt: upload.reviewedAt ?? null,
            reviewedBy: upload.reviewedBy
                ? `${upload.reviewedBy.firstName} ${upload.reviewedBy.lastName}`
                : null,
        };
    }

    async getPendingUploads() {
        return this.corRepository.getPendingUploads();
    }

    /** The single current PENDING upload id for a student (legacy delegation). */
    async findPendingUploadIdForStudent(studentId: string): Promise<string | null> {
        const upload = await this.corRepository.getPendingUploadByStudentId(studentId);
        return upload?.id ?? null;
    }

    /**
     * DL-3 canonical verify + promote. Validates Admin-confirmed data, then
     * delegates the entire authority transition to one repository transaction.
     * Notification is non-authoritative and never rolls back a promotion.
     */
    async verifyCor(corUploadId: string, adminId: string, data: VerifyCorData) {
        const studentNumber = String(data.studentNumber ?? "").trim();
        if (!studentNumber) {
            throw new AppError("Student Number is required.", 400);
        }

        const semester = data.semester ? String(data.semester).trim() : undefined;
        if (semester && !ALLOWED_SEMESTERS.includes(semester)) {
            throw new AppError(
                "Invalid semester. Use FIRST_SEM, SECOND_SEM, or SUMMER.",
                400,
            );
        }

        const upload = await this.corRepository.getUploadById(corUploadId);
        if (!upload) throw new AppError("COR Upload not found.", 404);
        if (upload.status !== "PENDING") {
            throw new AppError("Only pending COR uploads can be verified.", 400);
        }

        const student = upload.student;
        if (student.admissionStatus === "ENROLLED") {
            throw new AppError("Student is already enrolled.", 409);
        }

        const hasPassedExam = await this.corRepository.checkPassedExam(student.id);
        if (!hasPassedExam) {
            throw new AppError("Applicant has not passed the entrance exam.", 403);
        }

        let result: Awaited<ReturnType<CorRepository["verifyAndPromote"]>>;
        try {
            result = await this.corRepository.verifyAndPromote(
                corUploadId,
                student.id,
                student.userId,
                {
                    studentNumber,
                    academicYear: data.academicYear,
                    semester,
                    registrationNumber: data.registrationNumber,
                    verificationMethod: CANONICAL_VERIFICATION_METHOD,
                },
                adminId,
            );
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new AppError(
                    "Student Number is already in use. Choose a unique value.",
                    409,
                );
            }
            throw error;
        }

        // Non-authoritative side effect. A mail failure must not undo promotion.
        try {
            await EmailService.sendTemplateEmail(student.user.email, "credential_dispatch", {
                student_name: student.user.firstName,
                student_number: studentNumber,
                default_password: student.user.lastName.toUpperCase(),
                portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
            });
        } catch (emailError) {
            console.error("[COR verify] credential email failed:", emailError);
        }

        return {
            corRecord: result.corRecord,
            studentNumber,
            admissionStatus: "ENROLLED",
        };
    }

    /**
     * DL-3 canonical rejection. Only the exact PENDING upload may be rejected;
     * the reason is persisted explicitly, history is retained, and the
     * Applicant becomes eligible to resubmit.
     */
    async rejectCor(corUploadId: string, adminId: string, reason: string) {
        const trimmed = String(reason ?? "").trim();
        if (!trimmed) {
            throw new AppError("Rejection reason is required.", 400);
        }

        const upload = await this.corRepository.getUploadById(corUploadId);
        if (!upload) throw new AppError("COR Upload not found.", 404);
        if (upload.status !== "PENDING") {
            throw new AppError("Only pending COR uploads can be rejected.", 409);
        }

        return this.corRepository.rejectUpload(corUploadId, {
            reason: trimmed,
            adminId,
        });
    }

    private async safeDeleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch {
            // File may already be deleted or never written — ignore
        }
    }
}
