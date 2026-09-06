import fs from "fs/promises";
import path from "path";
import { fileTypeFromFile } from "file-type";
import { CorRepository } from "../repositories/cor.repository";
import { AppError } from "../utils/AppError";
import { EmailService } from "./email.service";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const EXTENSION_MAP: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
};

export class CorService {
    private corRepository = new CorRepository();

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

        // Prevent duplicate active uploads
        const activeUpload = await this.corRepository.getActiveUploadByStudentId(student.id);
        if (activeUpload) {
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "You already have a pending COR upload. Please wait for it to be reviewed before uploading a new one.",
                409,
            );
        }

        // Validate file contents via magic bytes — do not trust client MIME
        let detectedMime: string | undefined;
        try {
            const detected = await fileTypeFromFile(file.path);
            detectedMime = detected?.mime;

            if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
                await this.safeDeleteFile(file.path);
                throw new AppError(
                    "Invalid file content. Only PDF, JPEG, and PNG files are allowed.",
                    400,
                );
            }

            // Rename file to have the correct extension based on detected type
            const correctExt = EXTENSION_MAP[detectedMime];
            if (correctExt && !file.path.endsWith(correctExt)) {
                const newPath = file.path + correctExt;
                await fs.rename(file.path, newPath);
                file.path = newPath;
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            await this.safeDeleteFile(file.path);
            throw new AppError(
                "Unable to validate file contents. Please try again.",
                400,
            );
        }

        try {
            const uploadData = {
                studentId: student.id,
                filePath: file.path,
                originalFilename: file.originalname,
                detectedMimeType: detectedMime,
                status: "PENDING" as const,
                uploadedAt: new Date(),
            };

            const upload = await this.corRepository.createUpload(uploadData);

            await this.corRepository.createAuditLog(
                userId,
                "COR_UPLOAD",
                upload.id,
                `COR uploaded by applicant: ${file.originalname}`,
                undefined,
                JSON.stringify({ originalFilename: file.originalname, detectedMimeType: detectedMime }),
            );

            return upload;
        } catch (error) {
            // Cleanup file if database insert fails
            await this.safeDeleteFile(file.path);
            throw error;
        }
    }

    async getMyUpload(userId: string) {
        const student = await this.corRepository.findStudentByUserId(userId);
        if (!student) throw new AppError("Student profile not found.", 404);

        const upload = await this.corRepository.getUploadByStudentId(student.id);
        if (!upload) return null;

        const verifiedRecord = await this.corRepository.checkVerifiedRecord(upload.id);

        return {
            id: upload.id,
            originalFilename: upload.originalFilename,
            createdAt: upload.createdAt,
            status: upload.status,
            isVerified: !!verifiedRecord,
        };
    }

    async getPendingUploads() {
        return this.corRepository.getPendingUploads();
    }

    async verifyCor(corUploadId: string, adminId: string, data: {
        registrationNumber?: string;
        academicYear?: string;
        semester?: string;
        studentNumber?: string;
    }) {
        const upload = await this.corRepository.getUploadById(corUploadId);
        if (!upload) throw new AppError("COR Upload not found.", 404);

        if (upload.status !== "PENDING") {
            throw new AppError("Only pending COR uploads can be verified.", 400);
        }

        const student = upload.student;

        if (student.admissionStatus === "ENROLLED") {
            throw new AppError("Student is already enrolled.", 400);
        }

        const hasPassedExam = await this.corRepository.checkPassedExam(student.id);
        if (!hasPassedExam) {
            throw new AppError("Applicant has not passed the entrance exam.", 403);
        }

        const result = await this.corRepository.verifyAndPromote(
            corUploadId,
            student.id,
            student.userId,
            data,
            adminId,
        );

        await this.corRepository.createAuditLog(
            adminId,
            "COR_VERIFY",
            corUploadId,
            `COR verified and student enrolled: ${data.studentNumber}`,
            JSON.stringify({ status: "PENDING" }),
            JSON.stringify({ status: "VERIFIED", studentNumber: data.studentNumber }),
        );

        // Dispatch credential email
        await EmailService.sendTemplateEmail(student.user.email, "credential_dispatch", {
            student_name: student.user.firstName,
            student_number: data.studentNumber || "",
            default_password: student.user.lastName.toUpperCase(),
            portal_link: process.env.FRONTEND_URL || "http://localhost:3000",
        });

        return result;
    }

    async rejectCor(corUploadId: string, adminId: string, reason: string) {
        const upload = await this.corRepository.getUploadById(corUploadId);
        if (!upload) throw new AppError("COR Upload not found.", 404);

        if (upload.status === "VERIFIED") {
            throw new AppError("Cannot reject an already verified COR.", 400);
        }

        const result = await this.corRepository.updateUploadStatus(corUploadId, "REJECTED");

        await this.corRepository.createAuditLog(
            adminId,
            "COR_REJECT",
            corUploadId,
            `COR rejected: ${reason}`,
            JSON.stringify({ status: "PENDING" }),
            JSON.stringify({ status: "REJECTED", reason }),
        );

        return result;
    }

    private async safeDeleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch {
            // File may already be deleted or never written — ignore
        }
    }
}
