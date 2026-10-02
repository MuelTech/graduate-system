import { Request, Response } from "express";
import { DatabankService } from "../services/databank.service";
import { DatabankArchiveService } from "../services/databank-archive.service";

function sendDatabankError(res: Response, error: any): void {
  res.status(error?.statusCode || 400).json({ error: error.message });
}

export class DatabankController {
  private service = new DatabankService();
  private archiveService = new DatabankArchiveService();

  /**
   * DEPRECATED alias of `POST /databank/archive`.
   * The legacy JSON contract accepted client-controlled thesisId/title/paths;
   * those authority fields are now ignored. Only safe private metadata
   * (abstract/keywords) is considered, and ownership comes from the JWT.
   */
  createEntry = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.archiveService.registerArchive(userId, {
        abstract: req.body?.abstract,
        keywords: req.body?.keywords,
      });
      res.status(201).json(result);
    } catch (error: any) {
      sendDatabankError(res, error);
    }
  };

  /** STUDENT: private archive eligibility + research context + existing archive. */
  getArchiveContext = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.archiveService.getArchiveContext(userId);
      res.json(result);
    } catch (error: any) {
      sendDatabankError(res, error);
    }
  };

  /** STUDENT: register a private Databank archive for the completed research. */
  registerArchive = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.archiveService.registerArchive(userId, {
        abstract: req.body?.abstract,
        keywords: req.body?.keywords,
      });
      res.status(201).json(result);
    } catch (error: any) {
      sendDatabankError(res, error);
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
