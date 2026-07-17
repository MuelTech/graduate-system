import { Request, Response } from "express";
import { AdminApplicantService } from "../services/admin-applicant.service";
import { AppError } from "../utils/AppError";

export class AdminApplicantController {
  private service = new AdminApplicantService();

  listApplicants = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.listApplicants();
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
      const { id } = req.params;
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
      const { id } = req.params;
      const result = await this.service.validateWaiver(id);
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
      const { id } = req.params;
      const result = await this.service.rejectWaiver(id);
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
      const { id } = req.params;
      const result = await this.service.verifyCor(id);
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
      const { id } = req.params;
      const result = await this.service.rejectCor(id);
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
      const { id } = req.params;
      const result = await this.service.promoteToStudent(id);
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
      const { id } = req.params;
      const result = await this.service.resetStrikes(id);
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
