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
import {
  publishDefenseRealtimeEvent,
  publishDefenseRealtimeSequence,
} from "../realtime/defense-realtime.publish";
import { AppError } from "../utils/AppError";

export class DefenseCollaborationController {
  private collaboration = new DefenseCollaborationService();

  /**
   * Controlled domain errors keep their status + safe message. Anything else is
   * an unexpected internal failure: log server-side and return a generic 500 so
   * Prisma/query text, stack traces and internal paths are never exposed.
   */
  private sendError(res: Response, error: unknown): void {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("[defense-collaboration] unexpected error:", error);
    res.status(500).json({ error: "Internal server error." });
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
          initialComment: req.body?.initialComment,
        },
      );
      publishDefenseRealtimeEvent("annotation.created", {
        scheduleId: req.params.scheduleId as string,
        thesisDocumentId: annotation.thesisDocumentId,
        annotationId: annotation.id,
      });
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
      const result = await this.collaboration.createComment(
        req.params.scheduleId as string,
        userId,
        {
          annotationId: req.params.annotationId as string,
          body: req.body?.body,
          parentCommentId: req.body?.parentCommentId ?? null,
        },
      );
      publishDefenseRealtimeEvent("annotation.comment.created", {
        scheduleId: req.params.scheduleId as string,
        thesisDocumentId: result.thesisDocumentId,
        annotationId: req.params.annotationId as string,
        commentId: result.comment.id,
      });
      res.status(200).json({ comment: result.comment });
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
        req.body?.expectedBodyVersion ?? null,
      );
      publishDefenseRealtimeEvent("report.draft.updated", {
        scheduleId: req.params.scheduleId as string,
        reportId: result.reportId,
        bodyVersion: result.bodyVersion,
      });
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
      if (!result.alreadyFrozen) {
        publishDefenseRealtimeEvent("report.ready_for_signature", {
          scheduleId: req.params.scheduleId as string,
          reportId: result.reportId,
          contentVersion: result.contentVersion,
        });
      }
      res.status(200).json(result);
    } catch (error) {
      this.sendError(res, error);
    }
  };

  signCommitteeReport = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const result = await this.collaboration.signReportForSignatures(
        req.params.scheduleId as string,
        userId,
        req.body?.signatureData,
      );
      const signaturePayload = {
        scheduleId: req.params.scheduleId as string,
        reportId: result.reportId,
        contentVersion: result.contentVersion,
      };
      publishDefenseRealtimeSequence([
        { eventName: "rap.signature.recorded", payload: signaturePayload },
        ...(result.finalizedNow
          ? [
              {
                eventName: "rap.finalized" as const,
                payload: signaturePayload,
              },
            ]
          : []),
      ]);
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
