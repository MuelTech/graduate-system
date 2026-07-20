import { ExamEngineRepository } from "../repositories/exam-engine.repository";
import prisma from "../config/database";

export class ExamEngineService {
    private repo: ExamEngineRepository;

    constructor() {
        this.repo = new ExamEngineRepository();
    }

    // Validates if the current server time is within the applicant's scheduled 3-hour slot
    private async validateExamTime(applicationId: string) {
        const application = await prisma.entranceExamApplication.findUnique({
            where: { id: applicationId }
        });

        if (!application || !application.examDate || !application.examTime) {
            throw new Error("No scheduled exam found.");
        }

        const now = new Date();
        const scheduledDate = new Date(application.examDate);
        const scheduledTime = new Date(application.examTime);

        // Combine date and time for start boundary
        const examStart = new Date(
            scheduledDate.getFullYear(),
            scheduledDate.getMonth(),
            scheduledDate.getDate(),
            scheduledTime.getHours(),
            scheduledTime.getMinutes(), 0
        );

        const examEnd = new Date(examStart.getTime() + 3 * 60 * 60 * 1000);

        if (now < examStart) {
            throw new Error("Your exam window has not started yet.");
        }

        if (now > examEnd) {
            throw new Error("Your exam window has expired.");
        }

        return true;
    }

    async getQuestionsForApplicant(applicationId: string) {
        await this.validateExamTime(applicationId);

        return this.repo.getQuestionsForApplicant();
    }

    async autoSaveAnswer(applicationId: string, questionId: string, essayAnswer: string) {
        await this.validateExamTime(applicationId);

        return this.repo.autoSaveAnswer(applicationId, questionId, essayAnswer);
    }

    async submitAnswers(applicationId: string, answers: any[]) {
        await this.validateExamTime(applicationId);

        return this.repo.submitAnswers(applicationId, answers);
    }

    async getAllQuestionsForAdmin() {
        return this.repo.getAllQuestionsForAdmin();
    }

    async createQuestion(data: any) {
        return this.repo.createQuestion(data);
    }

    async updateQuestion(id: string, data: any) {
        return this.repo.updateQuestion(id, data);
    }

    async deleteQuestion(id: string) {
        return this.repo.deleteQuestion(id);
    }
}