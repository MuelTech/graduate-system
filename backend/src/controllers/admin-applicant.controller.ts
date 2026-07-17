// backend/src/controllers/admin-applicant.controller.ts

import { Request, Response } from "express";
import { AdminApplicantService } from "../services/admin-applicant.service";
import { AppError } from "../utils/AppError";

export class AdminApplicantController {
  private service = new AdminApplicantService();

  listApplicants = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        search: (req.query.search as string) || "",
        alignment: (req.query.alignment as string) || "",
        exam: (req.query.exam as string) || "",
        cor: (req.query.cor as string) || "",
        status: (req.query.status as string) || "",
      };

      const result = await this.service.listApplicants(query);
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

  getApplicantDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getApplicantDetail(id);
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

  validateWaiver = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const result = await this.service.validateWaiver(id, adminId);
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

  rejectWaiver = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const { adminNotes } = req.body;

      if (!adminNotes) {
        throw new AppError("Admin notes are required for rejection!", 400);
      }

      const result = await this.service.rejectWaiver(id, adminId, { adminNotes });
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

  verifyCor = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const { verificationMethod } = req.body;

      if (!verificationMethod) {
        throw new AppError("Verification method is required!", 400);
      }

      const result = await this.service.verifyCor(id, adminId, { verificationMethod });
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

  rejectCor = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const { reason } = req.body;

      if (!reason) {
        throw new AppError("Reason is required for rejection!", 400);
      }

      const result = await this.service.rejectCor(id, adminId, { reason });
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

  promoteToStudent = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const result = await this.service.promoteToStudent(id, adminId);
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

  resetStrikes = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user.userId;
      const result = await this.service.resetStrikes(id, adminId);
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
}
