import { Request, Response } from "express";
import { DatabankService } from "../services/databank.service";
import { DatabankArchiveService } from "../services/databank-archive.service";
import { RepositoryPublicationService } from "../services/repository-publication.service";

function sendDatabankError(res: Response, error: any): void {
  res.status(error?.statusCode || 400).json({ error: error.message });
}

/**
 * DL-10: Databank is the private archival surface. Repository publication is a
 * separate service/API (`/repository`). The legacy public read aliases below
 * delegate to the safe Repository publication service so they can never expose
 * a private archive or vary their payload by caller role. The legacy
 * publication *mutation* routes were removed; Admin publishes through
 * `/repository/admin/entries/:id/publish|unpublish`.
 */
export class DatabankController {
  private service = new DatabankService();
  private archiveService = new DatabankArchiveService();
  private publicationService = new RepositoryPublicationService();

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

  /** ADMIN: legacy archive list (no publication mutation). */
  getAllEntries = async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user?.role;
      const result = await this.service.getAllEntries(userRole);
      res.json(result);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  };

  /**
   * DEPRECATED alias of `GET /repository`. Delegates to the safe publication
   * service; the payload is identical regardless of authentication.
   */
  searchPublic = async (req: Request, res: Response) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const result = await this.publicationService.listPublished(query);
      res.json(result);
    } catch (error: any) {
      sendDatabankError(res, error);
    }
  };

  /**
   * DEPRECATED alias of `GET /repository/:id`. A private/unpublished archive is
   * indistinguishable from a missing one (404).
   */
  getEntryById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await this.publicationService.getPublished(id);
      res.json(result);
    } catch (error: any) {
      sendDatabankError(res, error);
    }
  };
}
