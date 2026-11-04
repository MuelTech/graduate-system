import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamService } from "../services/exam.service";
import { AppError } from "../utils/AppError";
import { validateAssignmentBody, validateBookingBody, validateBookingStatusBody } from "../services/exam-schedule.rules";
import { essayEvaluationBody } from "../services/exam-essay-evaluation.rules";

function schedulingError(res: Response, error: unknown): void {
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    error: error instanceof AppError ? error.message : "Could not complete the scheduling request.",
  });
}

export class ExamController {
  private examService = new ExamService();

  getAssignmentOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.examService.getAssignmentOptions(req.params.studentId));
    } catch (error: unknown) { schedulingError(res, error); }
  };

  assignApplicant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { studentId, slotId } = validateAssignmentBody(req.body);
      const application = await this.examService.assignApplicant(studentId, slotId);
      // Do not expose Student/account data from an expanded Prisma relation.
      res.status(201).json({ application: { id: application.id }, message: "Applicant assigned successfully." });
    } catch (error: unknown) { schedulingError(res, error); }
  };

  createSlot = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const slot = await this.examService.createSlot(req.body);
      res.status(201).json(slot);
    } catch (error: unknown) {
      schedulingError(res, error);
    }
  };

  getAllSlots = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const slots = await this.examService.getAllSlots();
      res.status(200).json(slots);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "An unexpected error occurred." });
    }
  };

  getApplicantStatus = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const status = await this.examService.getApplicantStatus(userId);
      res.status(200).json(status);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "An unexpected error occurred." });
    }
  };

  getAvailableSlots = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const slots = await this.examService.getAvailableSlots(
        userId, req.query.programId,
      );
      res.status(200).json(slots);
    } catch (error: unknown) {
      schedulingError(res, error);
    }
  };

  scheduleExam = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const application = await this.examService.scheduleExam(userId, validateBookingBody(req.body));
      res
        .status(201)
        .json({ message: "Exam scheduled successfully", application });
    } catch (error: unknown) {
      schedulingError(res, error);
    }
  };

  updateSlot = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const slot = await this.examService.updateSlot(id, req.body);
      res.status(200).json(slot);
    } catch (error: unknown) {
      schedulingError(res, error);
    }
  };

  toggleSlotStatus = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const slot = await this.examService.toggleSlotStatus(id, validateBookingStatusBody(req.body));
      res.status(200).json(slot);
    } catch (error: unknown) {
      schedulingError(res, error);
    }
  };

  getAllApplications = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const applications = await this.examService.getAllApplications();
      res.status(200).json(applications);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "An unexpected error occurred." });
    }
  };

  getApplicationDetail = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const id = req.params.id as string;
      const detail = await this.examService.getApplicationDetail(id);
      res.status(200).json(detail);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Could not load the examination record." });
      }
    }
  };

  appealMissedExam = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.examService.appealMissedExam(req.user!.userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getAppeals = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const appeals = await this.examService.getAppealedExams();
      res.status(200).json(appeals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  approveAppeal = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.examService.approveAppeal(
        req.params.id as string,
      );
      res.status(200).json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  rejectAppeal = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.examService.rejectAppeal(
        req.params.id as string,
      );
      res.status(200).json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getExamResult = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await this.examService.getExamResult(userId);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Could not load examination results." });
      }
    }
  };

    gradeEssay = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const applicationId = req.params.id as string;
      const essayScore = essayEvaluationBody(req.body);
      const result = await this.examService.gradeEssay(applicationId, essayScore, req.user!.userId);
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(error instanceof AppError ? error.statusCode : 500).json({
        error: error instanceof AppError ? error.message : "Could not save the essay evaluation.",
      });
    }
  }

    confirmResultAndEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const applicationId = req.params.id as string;
      const result = await this.examService.confirmResultAndEmail(applicationId);

      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(error instanceof AppError ? error.statusCode : 500).json({
        error: error instanceof AppError ? error.message : "Could not queue the result email.",
      });
    }
  }
}
