import { Response } from 'express';
import { EvaluationService } from '../services/evaluation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import type { SecureMulterFile } from '../middlewares/upload.middleware';
import {
  cleanupRequestUploads,
  commitRequestUploads,
} from '../storage/request-uploads';

export class EvaluationController {
  private evalService = new EvaluationService();

  // For Student Role
  submitRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const file = req.file as SecureMulterFile | undefined;
      if (!file) throw new AppError('Instrument file is required', 400);

      // DL-2: the file was already byte-validated and promoted by the secure
      // upload middleware; domain authorization stays in the service.
      const meta = file.storageMeta;
      const result = await this.evalService.submitEvaluationRequest(
        req.user.userId,
        req.body,
        {
          filePath: file.path,
          storageKey: meta?.storageKey ?? null,
          storageProvider: meta?.storageProvider ?? null,
          originalFilename: meta?.originalFilename ?? file.originalname,
          verifiedMimeType: meta?.verifiedMimeType ?? null,
          sizeBytes: meta?.sizeBytes ?? null,
          checksum: meta?.checksum ?? null,
          checksumAlgorithm: meta?.checksumAlgorithm ?? null,
          uploadedById: req.user.userId,
        },
      );

      commitRequestUploads(req);
      res.status(201).json({ message: 'Instrument submitted for evaluation successfully', result });
    } catch (error: any) {
      // Cleanup any promoted object + temp dir created for this request.
      await cleanupRequestUploads(req);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };

  // For Admin Role
  assignExpert = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const  id  = req.params.id as string; // requestId
      const data = { assignedById: req.user.userId };

      const result = await this.evalService.assignExpert(id, data);
      res.status(200).json({ message: 'Expert assigned successfully', result });
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  };
}
