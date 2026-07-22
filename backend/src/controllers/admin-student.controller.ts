// backend/src/controllers/admin-student.controller.ts

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminStudentService } from "../services/admin-student.service";
import { AppError } from "../utils/AppError";

export class AdminStudentController {
  private service = new AdminStudentService();

  listStudents = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        search: (req.query.search as string) || "",
        program: (req.query.program as string) || "",
        thesisStage: (req.query.thesisStage as string) || "",
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

  updateCompExamStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !["PENDING", "PASSED", "FAILED"].includes(status)) {
        throw new AppError("Invalid status. Must be PENDING, PASSED, or FAILED.", 400);
      }

      const result = await this.service.updateCompExamStatus(id, status);
      res.status(200).json({ message: "Comprehensive exam status updated.", result });
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
