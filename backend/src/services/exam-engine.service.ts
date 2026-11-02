import { ExamEngineRepository } from "../repositories/exam-engine.repository";
import { ExamExecutionRepository } from "../repositories/exam-execution.repository";
import { validateExamQuestion } from "./exam-content.rules";
import { AppError } from "../utils/AppError";

export class ExamEngineService {
    private repo: ExamEngineRepository;

    constructor() {
        this.repo = new ExamEngineRepository();
    }

    async assertApplicantQuestionAccess(userId: string, applicationId: string, mediaId: string) {
        return new ExamExecutionRepository().media(userId, applicationId, mediaId);
    }

    async getQuestionsForApplicant(applicationId: string, userId: string) {
        return new ExamExecutionRepository().questions(userId, applicationId);
    }

    async saveDraft(applicationId: string, payload: unknown, userId: string) {
        return this.repo.saveDraft(applicationId, payload, userId);
    }

    async readDrafts(applicationId: string, userId: string) {
        return this.repo.readDrafts(applicationId, userId);
    }

    async autoSaveAnswer(applicationId: string, questionId: unknown, essayAnswer: unknown, userId: string, expectedRevision: unknown) {
        const execution = await new ExamExecutionRepository().read(userId, applicationId);
        if (execution.state !== "ACTIVE") throw new AppError(execution.reason ?? "Examination is not active.", 409);
        return this.repo.autoSaveAnswer(applicationId, questionId, essayAnswer, expectedRevision, userId);
    }

    async submitAnswers(applicationId: string, answers: unknown, userId: string) {
        const execution = await new ExamExecutionRepository().read(userId, applicationId);
        if (execution.state !== "ACTIVE") throw new AppError(execution.reason ?? "Examination is not active.", 409);
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
