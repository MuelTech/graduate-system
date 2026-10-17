/**
 * CDW-6 — Defense History REST controller (read-only).
 *
 * Thin transport layer: reads the authenticated user + params, delegates all
 * authorization/domain work to DefenseHistoryService, and maps AppError status
 * codes to HTTP responses (matching repository conventions).
 *
 * There are NO write handlers here by design: historical attempts are immutable
 * and history is VIEW-ONLY. A current replacement committee member gains
 * read-only historical context, never historical write authority.
 */
import { Response } from "express";

import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { DefenseHistoryService } from "../services/defense-history.service";
import { AppError } from "../utils/AppError";

export class DefenseHistoryController {
  private history = new DefenseHistoryService();

  private sendError(res: Response, error: unknown): void {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("[defense-history] unexpected error:", error);
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

  /** GET /defense/:scheduleId/history — relevant prior attempts (summaries). */
  getDefenseHistory = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const history = await this.history.getHistory(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(history);
    } catch (error) {
      this.sendError(res, error);
    }
  };

  /** GET /defense/:scheduleId/history/:historicalScheduleId — read-only detail. */
  getDefenseHistoryAttempt = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    const userId = this.requireUser(req, res);
    if (!userId) return;
    try {
      const detail = await this.history.getHistoryDetail(
        req.params.scheduleId as string,
        req.params.historicalScheduleId as string,
        userId,
      );
      res.status(200).json(detail);
    } catch (error) {
      this.sendError(res, error);
    }
  };
}
