import { CorRepository } from "../repositories/cor.repository";
import { AppError } from "../utils/AppError";
import { sendMockEmail } from "../utils/email.mock";
import prisma from "../config/database";
import fs from "fs";

export class CorService {
  private corRepository = new CorRepository();

  async uploadCor(userId: string, file: Express.Multer.File) {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new AppError("Student profile not found.", 404);

    const hasPassedExam = await prisma.entranceExamApplication.findFirst({
      where: { studentId: student.id, status: "PASSED" }
    });

    if (!hasPassedExam) {
      throw new AppError(
        "You must pass the entrance exam before uploading your COR.",
        403,
      );
    }

    const uploadData = {
      studentId: student.id,
      filePath: file.path,
      originalFilename: file.originalname,
      uploadedAt: new Date(),
    };

    return this.corRepository.createUpload(uploadData);
  }

  async getMyUpload(userId: string) {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new AppError("Student profile not found.", 404);

    const upload = await this.corRepository.getUploadByStudentId(student.id);

    if (!upload) return null;

    // Check if there is an associated verified CorRecord
    const verifiedRecord = await prisma.corRecord.findFirst({
      where: { corUploadId: upload.id, isAdminVerified: true },
    });

    return {
      id: upload.id,
      originalFilename: upload.originalFilename,
      createdAt: upload.createdAt,
      status: verifiedRecord ? "verified" : "pending",
    };
  }

  async getPendingUploads() {
    return this.corRepository.getPendingUploads();
  }

  async verifyCor(corUploadId: string, adminId: string, data: any) {
    const upload = await this.corRepository.getUploadById(corUploadId);
    if (!upload) throw new AppError("COR Upload not found.", 404);

    const student = upload.student;

    if (student.admissionStatus === "ENROLLED") {
      throw new AppError("Student is already enrolled.", 400);
    }

    const hasPassedExam = await prisma.entranceExamApplication.findFirst({
      where: { studentId: student.id, status: "PASSED" }
    });

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

    // Extract DOB for mock password (with fallback if null)
    const dobStr = student.dateOfBirth
      ? student.dateOfBirth.toISOString().split("T")[0]
      : "DefaultPass123!";

    const emailMessage = `
Dear ${student.user.firstName},

Congratulations! Your Certificate of Registration has been verified.
You are now officially ENROLLED in the Graduate System.

Your Portal Credentials:
Username (Student No.): ${data.studentNumber}
Password: ${dobStr}

Please log in and change your password immediately.
        `;

    sendMockEmail(
      student.user.email,
      "Welcome to EARIST Graduate School!",
      emailMessage,
    );

    return result;
  }
}
