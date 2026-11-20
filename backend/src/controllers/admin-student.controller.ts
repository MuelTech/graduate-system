// backend/src/controllers/admin-student.controller.ts

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminStudentService } from "../services/admin-student.service";
import { CurriculumService } from "../services/curriculum.service";
import { handleCurriculumControllerError } from "./curriculum.controller";
import { AppError } from "../utils/AppError";

export class AdminStudentController {
  private service = new AdminStudentService();
  private curriculumService = new CurriculumService();

  listStudents = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        search: (req.query.search as string) || "",
        program: (req.query.program as string) || "",
        status: (req.query.status as string) || "",
      };
      const result = await this.service.listStudents(query);
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

  getStudentDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getStudentDetail(id);
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

  getStudentJourney = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getStudentJourney(id);
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

  recordCompExamAttempt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { status, examDate, remarks } = req.body ?? {};
      const result = await this.service.recordCompExamAttempt(id, adminId, {
        status,
        examDate,
        remarks,
      });
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

  correctLatestCompExamAttempt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { status, examDate, remarks, reason } = req.body ?? {};
      const result = await this.service.correctLatestCompExamAttempt(id, adminId, {
        status,
        examDate,
        remarks,
        reason,
      });
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

  getCompExamCertificateFoundation = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getCompExamCertificateFoundation(id);
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

  updateStudent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.service.updateStudent(id, adminId, req.body);
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

  resetStudentPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.service.resetStudentPassword(id, adminId);
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

  getStudentCurriculum = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");
      const result = await this.curriculumService.getStudentChecklistByStudentId(id);
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error loading admin student curriculum checklist:",
      );
    }
  };

  assignStudentCurriculumVersion = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");
      const adminId = req.user?.userId ?? "";
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.assignStudentCurriculumVersion(
        id,
        adminId,
        req.body ?? {},
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error assigning student curriculum version:",
      );
    }
  };

  updateStudentCourseProgress = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");
      const courseId = String(req.params.courseId ?? "");
      const adminId = req.user?.userId ?? "";
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.updateCourseProgress({
        actorRole: "ADMIN",
        actorUserId: adminId,
        targetId: id,
        courseId,
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

  verifyAllStudentCourses = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");
      const adminId = req.user?.userId ?? "";
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.verifyAllPassedCourses(id, adminId);
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(
        res,
        error,
        "Error verifying student coursework subjects:",
      );
    }
  };

  updateStudentPublicationMilestone = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");
      const adminId = req.user?.userId ?? "";
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.curriculumService.updatePublicationMilestone({
        actorRole: "ADMIN",
        actorUserId: adminId,
        targetId: id,
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
