import { ExamEngineRepository } from "../repositories/exam-engine.repository";
import prisma from "../config/database";
import { validateExamQuestion } from "./exam-content.rules";
import { AppError } from "../utils/AppError";

export class ExamEngineService {
    private repo: ExamEngineRepository;

    constructor() {
        this.repo = new ExamEngineRepository();
    }

    // Shared with confidential media retrieval; preserves the existing lookup.
    async getApplicationIdForUser(userId: string) {
        const student = await prisma.student.findUnique({ where: { userId } });
        if (!student) throw new AppError("Student profile not found.", 404);
        const application = await prisma.entranceExamApplication.findFirst({
            where: { studentId: student.id },
            orderBy: { createdAt: "desc" },
        });
        if (!application) throw new AppError("Exam application not found.", 404);
        return application.id;
    }

    async assertApplicantQuestionAccess(userId: string) {
        const applicationId = await this.getApplicationIdForUser(userId);
        await this.validateExamTime(applicationId);
    }

    // Validates if the current server time is within the applicant's scheduled 3-hour slot
    private async validateExamTime(applicationId: string) {
        const application = await prisma.entranceExamApplication.findUnique({
            where: { id: applicationId },
            include: { slot: true }
        });

        const dateToUse = application?.slot?.examDate || application?.examDate;
        const timeToUse = application?.slot?.examTime || application?.examTime;

        if (!application || !dateToUse || !timeToUse) {
            throw new AppError("No scheduled exam found.", 400);
        }

        const now = new Date();
        const scheduledDate = new Date(dateToUse);
        const scheduledTime = new Date(timeToUse);

        // Combine date and time for start boundary
        const examStart = new Date(
            scheduledDate.getFullYear(),
            scheduledDate.getMonth(),
            scheduledDate.getDate(),
            scheduledTime.getHours(),
            scheduledTime.getMinutes(), 0
        );

        const examEnd = new Date(examStart.getTime() + 3 * 60 * 60 * 1000);

        // Add a 60-second grace period for minor clock drift between frontend and backend
        const gracePeriodStart = new Date(examStart.getTime() - 60000);

        if (now < gracePeriodStart) {
            throw new AppError(`Your exam window has not started yet. (Server Time: ${now.toLocaleString()}, Exam Start: ${examStart.toLocaleString()})`, 400);
        }

        if (now > examEnd) {
            throw new AppError("Your exam window has expired.", 400);
        }

        return true;
    }

    async getQuestionsForApplicant(applicationId: string) {
        await this.validateExamTime(applicationId);

        return this.repo.getQuestionsForApplicant();
    }

    async autoSaveAnswer(applicationId: string, questionId: unknown, essayAnswer: unknown) {
        await this.validateExamTime(applicationId);

        return this.repo.autoSaveAnswer(applicationId, questionId, essayAnswer);
    }

    async submitAnswers(applicationId: string, answers: unknown) {
        await this.validateExamTime(applicationId);

        return this.repo.submitAnswers(applicationId, answers);
    }

    async getAllQuestionsForAdmin() {
        return this.repo.getAllQuestionsForAdmin();
    }

    async createQuestion(data: unknown) {
        return this.repo.createQuestion(validateExamQuestion(data));
    }

    async updateQuestion(id: string, data: unknown) {
        return this.repo.updateQuestion(id, data);
    }

    async deleteQuestion(id: string) {
        return this.repo.deleteQuestion(id);
    }
}
