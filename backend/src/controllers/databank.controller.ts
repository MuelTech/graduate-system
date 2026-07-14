import { Request, Response } from "express";
import { DatabankService } from "../services/databank.service";

export class DatabankController {
  private service = new DatabankService();

  createEntry = async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const result = await this.service.createEntry(data);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getAllEntries = async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user?.role;
      const result = await this.service.getAllEntries(userRole);
      res.json(result);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  };

  searchPublic = async (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.q as string | undefined;
      // If no token is provided, the middleware might not set user. We default to null.
      const userRole = (req as any).user?.role || null;
      
      const result = await this.service.searchPublic(searchQuery, userRole);
      res.json(result);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  };

  getEntryById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userRole = (req as any).user?.role || null;
      
      const result = await this.service.getEntryById(id, userRole);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };

  approveAndPublish = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const adminId = (req as any).user?.id;
      const result = await this.service.approveAndPublish(id, adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  unpublish = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await this.service.unpublish(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  editMetadata = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const data = req.body; 
      const result = await this.service.editMetadata(id, data);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
