import { examAdministrationAuthorization } from "../access/exam-administration-authorization";
import { ExamEngineRepository } from "../repositories/exam-engine.repository";
import { ExamExecutionRepository } from "../repositories/exam-execution.repository";
import { validateExamQuestion } from "./exam-content.rules";
import { ExamFinalizationRepository } from "../repositories/exam-finalization.repository";
import { AppError } from "../utils/AppError";

export class ExamEngineService {
    private repo: ExamEngineRepository;

    constructor(private readonly access = examAdministrationAuthorization) {
        this.repo = new ExamEngineRepository(this.access);
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

    async submitAnswers(applicationId: string, confirmation: unknown, userId: string) {
        return new ExamFinalizationRepository().submit(applicationId, confirmation, userId);
    }
    async readFinalization(applicationId: string, userId: string) {
        return new ExamFinalizationRepository().read(applicationId, userId);
    }
    async getAllQuestionsForAdmin(actorId: string) {
        await this.access.assert(actorId, "exam.questions.view");
        return this.repo.getAllQuestionsForAdmin(actorId);
    }

    async createQuestion(data: unknown, actorId: string) {
        await this.access.assert(actorId, "exam.questions.manage");
        return this.repo.createQuestion(validateExamQuestion(data), actorId);
    }

    async updateQuestion(id: string, data: unknown, actorId: string) {
        await this.access.assert(actorId, "exam.questions.manage");
        return this.repo.updateQuestion(id, data, actorId);
    }

    async deleteQuestion(id: string, actorId: string) {
        await this.access.assert(actorId, "exam.questions.manage");
        return this.repo.deleteQuestion(id, actorId);
    }
}
