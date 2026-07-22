import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ExamService } from "../services/exam.service";
import { AppError } from "../utils/AppError";

export class ExamController {
  private examService = new ExamService();

  createSlot = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const slot = await this.examService.createSlot(req.body);
      res.status(201).json(slot);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
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
      const { programId } = req.query;
      if (!programId) {
        res.status(400).json({ error: "programId is required" });
        return;
      }
      const slots = await this.examService.getAvailableSlots(
        programId as string,
      );
      res.status(200).json(slots);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };

  scheduleExam = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { slotId } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const application = await this.examService.scheduleExam(userId, slotId);
      res
        .status(201)
        .json({ message: "Exam scheduled successfully", application });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
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
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "An unexpected error occurred." });
    }
  };

  toggleSlotStatus = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { isActive } = req.body;
      const slot = await this.examService.toggleSlotStatus(id, isActive);
      res.status(200).json(slot);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "An unexpected error occurred." });
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

      appealMissedExam = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const result = await this.examService.appealMissedExam(req.user!.userId);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}
