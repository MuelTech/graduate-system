import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamEngineService } from "../services/exam-engine.service";
import { AppError } from "../utils/AppError";
import { submissionConfirmation, IncompleteExamSubmissionError } from "../services/exam-finalization.rules";
import { validateDraft } from "../services/exam-answer.rules";

export class ExamEngineController {
    private service: ExamEngineService;

    constructor() {
        this.service = new ExamEngineService();
    }

    getQuestionsForApplicant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const questions = await this.service.getQuestionsForApplicant(req.params.applicationId as string, req.user!.userId);

            res.status(200).json(questions);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not load examination content." });
        }
    }

    autoSaveAnswer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const answer = validateDraft(req.body);
            const appId = req.params.applicationId as string;
            const saved = await this.service.saveDraft(appId, answer, req.user!.userId);
            res.status(200).json(saved);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not save answer." });
        }
    }

    readDrafts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            res.status(200).json(await this.service.readDrafts(req.params.applicationId as string, req.user!.userId));
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not load saved answers." });
        }
    }

    submitAnswers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const confirmation = submissionConfirmation(req.body);
            const appId = req.params.applicationId as string;
            const result = await this.service.submitAnswers(appId, confirmation, req.user!.userId);

            res.status(200).json(result);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({
                error: error instanceof AppError ? error.message : "Could not submit answers.",
                ...(error instanceof IncompleteExamSubmissionError ? { code: error.code, answeredCount: error.answeredCount, unansweredCount: error.unansweredCount } : {}),
            });
        }
    }

    readFinalization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            res.status(200).json(await this.service.readFinalization(req.params.applicationId as string, req.user!.userId));
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not retrieve examination receipt." });
        }
    };

    getAllQuestionsForAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const questions = await this.service.getAllQuestionsForAdmin(req.user!.userId);

            res.status(200).json(questions);
        } catch (error: any) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error.message });
        }
    }

    createQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const question = await this.service.createQuestion(req.body, req.user!.userId);

            res.status(201).json(question);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not create question." });
        }
    }

    updateQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const question = await this.service.updateQuestion(req.params.id as string, req.body, req.user!.userId);

            res.status(200).json(question);
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not update question." });
        }
    }

    deleteQuestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            await this.service.deleteQuestion(req.params.id as string, req.user!.userId);

            res.status(200).json({ success: true });
        } catch (error: unknown) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({ error: error instanceof AppError ? error.message : "Could not delete question." });
        }
    }

}
