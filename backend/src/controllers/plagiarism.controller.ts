import { Request, Response, NextFunction } from 'express';
import { StrikePlagiarismService } from '../services/strike-plagiarism.service';
import { PlagiarismRepository } from '../repositories/plagiarism.repository';

export class PlagiarismController {
  private service = new StrikePlagiarismService();
  private repo = new PlagiarismRepository();

  /**
   * Health / Connectivity test with StrikePlagiarism.
   * GET /api/thesis/plagiarism/health
   */
  testConnection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.testConnection();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Student portal status endpoint.
   * GET /api/thesis/plagiarism/my-status
   */
  getMyStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const status = await this.service.getStudentPlagiarismStatus(userId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Submits a manuscript for plagiarism verification.
   * POST /api/thesis/plagiarism/:thesisId/submit
   */
  submitForCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thesisId = Array.isArray(req.params.thesisId) ? req.params.thesisId[0] : req.params.thesisId;
      const result = await this.service.submitManuscriptForCheck(String(thesisId));
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Checks analysis status of a document on StrikePlagiarism.
   * GET /api/thesis/plagiarism/status/:documentId
   */
  getDocumentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
      const status = await this.service.getDocumentStatus(String(documentId));
      res.json(status);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Syncs completed StrikePlagiarism report into the database.
   * POST /api/thesis/plagiarism/:thesisId/sync/:documentId
   */
  syncResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thesisId = Array.isArray(req.params.thesisId) ? req.params.thesisId[0] : req.params.thesisId;
      const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;
      const result = await this.service.syncAndRecordResult(String(thesisId), String(documentId));
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * StrikePlagiarism Webhook Callback endpoint.
   * POST /api/thesis/plagiarism/callback
   */
  handleWebhookCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, documentId, thesisId } = req.body;
      const targetDocId = documentId || id;
      if (thesisId && targetDocId) {
        await this.service.syncAndRecordResult(String(thesisId), String(targetDocId));
      }
      res.json({ success: true, received: true });
    } catch (error) {
      next(error);
    }
  };
}
