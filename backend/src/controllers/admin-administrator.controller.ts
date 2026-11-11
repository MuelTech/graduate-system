import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminAdministratorService } from "../services/admin-administrator.service";
import { AppError } from "../utils/AppError";

const service = new AdminAdministratorService();

export class AdminAdministratorController {
  async getAllAdministrators(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const list = await service.getAllAdministrators();
      res.json(list);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch administrators." });
      }
    }
  }

  async getAdministratorById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const admin = await service.getAdministratorById(id);
      res.json(admin);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch administrator details." });
      }
    }
  }

  async createAdministrator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const actorId = req.user?.userId;
      if (!actorId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const created = await service.createAdministrator(req.body, actorId);
      res.status(201).json(created);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create administrator." });
      }
    }
  }

  async updateAdministrator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const actorId = req.user?.userId;
      if (!actorId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const id = String(req.params.id);
      const updated = await service.updateAdministrator(id, req.body, actorId);
      res.json(updated);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update administrator." });
      }
    }
  }
}
