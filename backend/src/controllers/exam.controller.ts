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
}
