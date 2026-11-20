import { Response } from "express";
import { StudentService } from "../services/student.service";
import { CurriculumService } from "../services/curriculum.service";
import { handleCurriculumControllerError } from "./curriculum.controller";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AppError } from "../utils/AppError";

export class StudentController {
  private studentService = new StudentService();
  private curriculumService = new CurriculumService();

  // For Student Role
  getJourney = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const journey = await this.studentService.getStudentJourney(req.user.userId);
      res.status(200).json(journey);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };

  // For Student Role — Comprehensive Exam certification foundation
  getCompExamCertificateFoundation = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.studentService.getCompExamCertificateFoundation(
        req.user.userId,
      );
      res.status(200).json(result);
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

  // For Admin Role — delegates to AdminStudentService 3-attempt logic
  updateCompExam = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; // studentId
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.studentService.updateCompExam(id, adminId, req.body);
      res.status(200).json(result);
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

  getCurriculumChecklist = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.getStudentChecklistByUserId(
        req.user.userId,
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error loading student curriculum checklist:",
      );
    }
  };

  updateCourseProgress = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.updateCourseProgress({
        actorRole: "STUDENT",
        actorUserId: req.user.userId,
        targetId: req.user.userId,
        courseId: String(req.params.courseId ?? ""),
        body: req.body ?? {},
      });
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error updating student coursework progress:",
      );
    }
  };

  updatePublicationMilestone = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.updatePublicationMilestone({
        actorRole: "STUDENT",
        actorUserId: req.user.userId,
        targetId: req.user.userId,
        body: req.body ?? {},
      });
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error updating student publication milestone:",
      );
    }
  };
}
