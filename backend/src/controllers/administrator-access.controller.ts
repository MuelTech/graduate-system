import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdministratorAccessService } from "../services/administrator-access.service";
import { AppError } from "../utils/AppError";

export class AdministratorAccessController {
  constructor(private readonly service: AdministratorAccessService) {}

  private async respond(req: AuthenticatedRequest, res: Response, action: (actorId: string) => Promise<unknown>, status = 200) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    if (!req.user) { res.status(401).json({ error: "Authentication required." }); return; }
    try { res.status(status).json(await action(req.user.userId)); }
    catch (error) {
      res.status(error instanceof AppError ? error.statusCode : 500).json({
        error: error instanceof AppError ? error.message : "Administrator management could not be completed.",
      });
    }
  }
  list = (req: AuthenticatedRequest, res: Response) => this.respond(req, res, id => this.service.list(id, req.query));
  get = (req: AuthenticatedRequest, res: Response) => this.respond(req, res, id => this.service.get(id, req.params.userId));
  create = (req: AuthenticatedRequest, res: Response) => this.respond(req, res, id => this.service.create(id, req.body), 201);
  update = (req: AuthenticatedRequest, res: Response) => this.respond(req, res, id => this.service.update(id, req.params.userId, req.body));
  removeAccess = (req: AuthenticatedRequest, res: Response) => this.respond(req, res, id => this.service.removeAccess(id, req.params.userId));
}
