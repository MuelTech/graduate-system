import { CorRepository } from "../repositories/cor.repository";
import { AppError } from "../utils/AppError";
import { sendMockEmail } from "../utils/email.mock";
import { EmailService } from "./email.service";

export class CorService {
  private corRepository = new CorRepository();

  async uploadCor(userId: string, file: Express.Multer.File) {
    const student = await this.corRepository.findStudentByUserId(userId);
    if (!student) throw new AppError("Student profile not found.", 404);

    const hasPassedExam = await this.corRepository.checkPassedExam(student.id);

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
    const student = await this.corRepository.findStudentByUserId(userId);
    if (!student) throw new AppError("Student profile not found.", 404);

    const upload = await this.corRepository.getUploadByStudentId(student.id);

    if (!upload) return null;

    // Check if there is an associated verified CorRecord
    const verifiedRecord = await this.corRepository.checkVerifiedRecord(upload.id);

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

    // Extract DOB for mock password (with fallback if null)
    const dobStr = student.dateOfBirth
      ? student.dateOfBirth.toISOString().split("T")[0]
      : "DefaultPass123!";

    // Dispatch real credential email via BullMQ
    await EmailService.sendTemplateEmail(student.user.email, "credential_dispatch", {
        student_name: student.user.firstName,
        student_number: data.studentNumber,
        default_password: student.user.lastName.toUpperCase(), // Using ALL CAPS lastname as requested
        portal_link: process.env.FRONTEND_URL || "http://localhost:3000"
    });

    return result;
  }
}
