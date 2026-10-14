import { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { RepositoryPublicationService } from "../services/repository-publication.service";

/**
 * DL-10: Research Repository publication controller.
 *
 * Public read handlers never inspect authentication. Admin mutation handlers
 * take the actor identity from the authenticated JWT (`req.user.userId`) and
 * never from the request body.
 */

function sendRepositoryError(res: Response, error: unknown): void {
  const status = (error as { statusCode?: number })?.statusCode ?? 500;
  const message =
    error instanceof Error ? error.message : "Unexpected repository error.";
  res.status(status).json({ error: message });
}

export class RepositoryController {
  constructor(
    private readonly service = new RepositoryPublicationService(),
  ) {}

  /** PUBLIC: list published Repository metadata. */
  listPublic = async (req: Request, res: Response) => {
    try {
      const query =
        typeof req.query.q === "string" ? req.query.q : undefined;
      const result = await this.service.listPublished(query);
      res.json(result);
    } catch (error) {
      sendRepositoryError(res, error);
    }
  };

  /** PUBLIC: one published Repository entry; private/unknown -> 404. */
  getPublic = async (req: Request, res: Response) => {
    try {
      const result = await this.service.getPublished(req.params.id as string);
      res.json(result);
    } catch (error) {
      sendRepositoryError(res, error);
    }
  };

  /** ADMIN: private archive + publication-state queue. */
  listAdmin = async (_req: Request, res: Response) => {
    try {
      const result = await this.service.listAdminEntries();
      res.json(result);
    } catch (error) {
      sendRepositoryError(res, error);
    }
  };

  /** ADMIN: publish Repository metadata for a private archive. */
  publish = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.service.publishMetadata(
        req.params.id as string,
        adminId,
      );
      res.json(result);
    } catch (error) {
      sendRepositoryError(res, error);
    }
  };

  /** ADMIN: remove Repository metadata (private archive is untouched). */
  unpublish = async (req: Request, res: Response) => {
    try {
      const result = await this.service.unpublishMetadata(
        req.params.id as string,
      );
      res.json(result);
    } catch (error) {
      sendRepositoryError(res, error);
    }
  };
}
