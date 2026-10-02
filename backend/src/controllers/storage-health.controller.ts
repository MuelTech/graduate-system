import { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { STORAGE_OPERATIONS_CONFIG } from "../utils/file.utils";
import { StorageHealthRepository } from "../repositories/storage-health.repository";
import { storageProvider } from "../storage";
import { LocalStorageDiagnostics } from "../storage/local-storage.diagnostics";
import { uploadTelemetry } from "../storage/upload-telemetry";
import { StorageHealthService } from "../services/storage-health.service";

/**
 * DL-11: read-only storage health / integrity diagnostics controller.
 *
 * These handlers never mutate storage or workflow records. Unexpected failures
 * return a controlled 500 that does not leak paths, SQL, or stack traces.
 */

function sendStorageError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Unexpected storage diagnostics error." });
}

const defaultService = new StorageHealthService(
  new LocalStorageDiagnostics(storageProvider),
  new StorageHealthRepository(),
  STORAGE_OPERATIONS_CONFIG,
  uploadTelemetry,
);

export class StorageHealthController {
  constructor(
    private readonly service: StorageHealthService = defaultService,
  ) {}

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await this.service.getHealth());
    } catch (error) {
      sendStorageError(res, error);
    }
  };

  runIntegrityScan = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await this.service.runIntegrityScan());
    } catch (error) {
      sendStorageError(res, error);
    }
  };
}
