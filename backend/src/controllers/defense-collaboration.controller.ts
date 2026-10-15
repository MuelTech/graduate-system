/**
 * CDW-1 — collaborative Defense Workspace REST controller.
 *
 * Thin transport layer: reads the authenticated user + params/body, delegates
 * all authorization/domain work to DefenseCollaborationService, and maps
 * AppError status codes to HTTP responses (matching repository conventions).
 */
import { Response } from "express";

import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { DefenseCollaborationService } from "../services/defense-collaboration.service";

export class DefenseCollaborationController {
  private collaboration = new DefenseCollaborationService();

  private sendError(res: Response, error: unknown): void {
    const status = (error as { statusCode?: number })?.statusCode || 400;
    const message = error instanceof Error ? error.message : "Unexpected error.";
    res.status(status).json({ error: message });
  }

  private requireUser(req: AuthenticatedRequest, res: Response): string | null {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return userId;
  }

  getCollaborationAnnotations = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const documentId =
        typeof req.query.documentId === "string" ? req.query.documentId : "";
      const annotations = await this.collaboration.listAnnotations(
        req.params.scheduleId as string,
        userId,
        documentId,
      );
      res.status(200).json({ annotations });
    } catch (error) {
      this.sendError(res, error);
    }
  };

  createCollaborationAnnotation = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const annotation = await this.collaboration.createAnnotation(
        req.params.scheduleId as string,
        userId,
        {
          thesisDocumentId: req.body?.thesisDocumentId,
          anchor: req.body?.anchor,
        },
      );
      res.status(200).json({ annotation });
    } catch (error) {
      this.sendError(res, error);
    }
  };

  createAnnotationComment = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const comment = await this.collaboration.createComment(
        req.params.scheduleId as string,
        userId,
        {
          annotationId: req.params.annotationId as string,
          body: req.body?.body,
          parentCommentId: req.body?.parentCommentId ?? null,
        },
      );
      res.status(200).json({ comment });
    } catch (error) {
      this.sendError(res, error);
    }
  };

  getCommitteeReport = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const report = await this.collaboration.getReportReadModel(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(report);
    } catch (error) {
      this.sendError(res, error);
    }
  };

  saveCommitteeReportDraft = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const result = await this.collaboration.saveReportDraft(
        req.params.scheduleId as string,
        userId,
        req.body?.body,
      );
      res.status(200).json(result);
    } catch (error) {
      this.sendError(res, error);
    }
  };

  freezeCommitteeReport = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const result = await this.collaboration.freezeReportForSignatures(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(result);
    } catch (error) {
      this.sendError(res, error);
    }
  };

  getConclusionReadiness = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const readiness = await this.collaboration.getConclusionReadiness(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(readiness);
    } catch (error) {
      this.sendError(res, error);
    }
  };
}
