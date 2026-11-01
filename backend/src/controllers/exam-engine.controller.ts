import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamEngineService } from "../services/exam-engine.service";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { validateSubmissionBody, validateEssayAutosave } from "../services/exam-answer.rules";

export class ExamEngineController {
    private service: ExamEngineService;

    constructor() {
        this.service = new ExamEngineService();
    }

    // Helper to get applicationId from userId
    private async getAppId(userId: string) {
        return this.service.getApplicationIdForUser(userId);
    }

    getQuestionsForApplicant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const appId = await this.getAppId(req.user!.userId);
            const questions = await this.service.getQuestionsForApplicant(appId);

            res.status(200).json(questions);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    autoSaveAnswer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { questionId, essayAnswer } = validateEssayAutosave(req.body);
            const appId = await this.getAppId(req.user!.userId);

            await this.service.autoSaveAnswer(appId, questionId, essayAnswer);

            res.status(200).json({ success: true });
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not save answer." });
        }
    }

    submitAnswers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const answers = validateSubmissionBody(req.body);
            const appId = await this.getAppId(req.user!.userId);
            const result = await this.service.submitAnswers(appId, answers);

            res.status(200).json(result);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not submit answers." });
        }
    }

    getAllQuestionsForAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const questions = await this.service.getAllQuestionsForAdmin();

            res.status(200).json(questions);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    createQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const question = await this.service.createQuestion(req.body);

            res.status(201).json(question);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not create question." });
        }
    }

    updateQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const question = await this.service.updateQuestion(req.params.id as string, req.body);

            res.status(200).json(question);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not update question." });
        }
    }

    deleteQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            await this.service.deleteQuestion(req.params.id as string);

            res.status(200).json({ success: true });
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not delete question." });
        }
    }

    getSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const appId = await this.getAppId(req.user!.userId);
            const app = await prisma.entranceExamApplication.findUnique({
                where: { id: appId },
                select: {
                    examDate: true,
                    examTime: true,
                    status: true
                }
            });

            if (!app) {
                res.status(404).json({ error: "Exam application record not found." });
                return;
            }

            res.status(200).json(app);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}
