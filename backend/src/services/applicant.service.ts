import { hasAuthoritativePassedExam } from "./admin-applicant-list.rules";
import { ApplicantRepository } from '../repositories/applicant.repository';
import { AppError } from "../utils/AppError";
import { validatePhilippineMobile } from "../utils/phone";

export class ApplicantService {
    private applicantRepo = new ApplicantRepository();

    async getProfile(userId: string) {
        const student = await this.applicantRepo.getProfileWithRelations(userId);

        if (!student) {
            throw new AppError("Applicant profile not found", 404);
        }

        const hasPassed = hasAuthoritativePassedExam(student.examApplications);
        const calculatedStep = hasPassed ? 2 : 1;
        const latestExam = student.examApplications[0];

        return {
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            email: student.user.email,
            cellphone: student.cellphone ?? null,
            applicantId: student.pinnacleApplicantId,
            program: student.program.programName,
            programType: student.program.programType,
            programCode: student.program.programCode ?? null,
            currentStep: calculatedStep,
            examStatus: hasPassed ? "PASSED" : (latestExam?.status ?? "NOT_SCHEDULED"),
            hasPassedExam: hasPassed,
            examDate: latestExam?.slot?.examDate || null,
            examTime: latestExam?.slot?.examTime || null,
            registeredAt: student.createdAt.toISOString(),
        };
    }

    async updateProfile(userId: string, input: { cellphone?: unknown }) {
        const cellphone = validatePhilippineMobile(input?.cellphone);
        const updated = await this.applicantRepo.updateContactCellphone(userId, cellphone);
        if (!updated) {
            throw new AppError("Applicant profile not found", 404);
        }
        return {
            message: "Contact number updated.",
            cellphone: updated.cellphone,
        };
    }
}
