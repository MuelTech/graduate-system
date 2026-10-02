import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { storageProvider } from "./index";
import {
  cleanupRequestUploads,
  registerPromotedUpload,
  setRequestTempDir,
} from "./request-uploads";
import type { StorageProvider } from "./storage.types";
import { UploadPipeline } from "./upload-pipeline";
import {
  getUploadPolicy,
  type UploadPolicy,
  type UploadPolicyName,
} from "./upload-policy";

/**
 * DL-2: secure shared upload middleware.
 *
 * Pipeline per request:
 *   authenticate/authorize (route-level, unchanged)
 *   -> stream each part into a private per-request temp directory
 *   -> detect actual content bytes, enforce the category policy
 *   -> compute size + SHA-256
 *   -> promote to a managed permanent key
 *   -> expose promoted metadata on the multer file object
 *
 * The middleware records promoted keys + the temp directory for request-level
 * cleanup. Domain services keep their own authorization/business authority.
 */

export interface SecureMulterFile extends Express.Multer.File {
  storageMeta?: {
    storageKey: string;
    storageProvider: string;
    originalFilename: string;
    verifiedMimeType: string | null;
    sizeBytes: number;
    checksum: string;
    checksumAlgorithm: string;
  };
}

export interface SecureUpload {
  single(field: string): RequestHandler;
  fields(fields: multer.Field[]): RequestHandler;
  any(): RequestHandler;
}

export type SecureUploadFactory = (
  policy: UploadPolicyName | UploadPolicy,
) => SecureUpload;

function resolvePolicy(
  policy: UploadPolicyName | UploadPolicy,
): UploadPolicy {
  return typeof policy === "string" ? getUploadPolicy(policy) : policy;
}

function collectFiles(req: unknown): Express.Multer.File[] {
  const anyReq = req as {
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
  };
  if (anyReq.file) return [anyReq.file];
  if (Array.isArray(anyReq.files)) return anyReq.files;
  if (anyReq.files) return Object.values(anyReq.files).flat();
  return [];
}

function mapMulterError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError("Uploaded file exceeds the maximum allowed size.", 413);
    }
    if (
      error.code === "LIMIT_FILE_COUNT" ||
      error.code === "LIMIT_UNEXPECTED_FILE" ||
      error.code === "LIMIT_PART_COUNT"
    ) {
      return new AppError("Unexpected or too many files in the upload.", 400);
    }
    return new AppError("Invalid multipart upload.", 400);
  }
  return new AppError("Upload failed.", 400);
}

export function createSecureUpload(provider: StorageProvider): SecureUploadFactory {
  const pipeline = new UploadPipeline(provider);

  function requestTempDir(req: object): string {
    const anyReq = req as { __dl2TempDir?: string };
    if (anyReq.__dl2TempDir) return anyReq.__dl2TempDir;
    const id = crypto.randomBytes(16).toString("hex");
    const dir = path.join(provider.temporaryRoot(), id);
    fs.mkdirSync(dir, { recursive: true });
    setRequestTempDir(req, dir, provider);
    anyReq.__dl2TempDir = dir;
    return dir;
  }

  const storage: multer.StorageEngine = multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        cb(null, requestTempDir(req));
      } catch (error) {
        cb(error as Error, "");
      }
    },
    filename: (_req, _file, cb) => {
      // Server-controlled random name; never derived from client input.
      cb(null, crypto.randomBytes(24).toString("hex"));
    },
  });

  async function promoteFiles(
    req: object,
    policy: UploadPolicy,
  ): Promise<void> {
    for (const file of collectFiles(req)) {
      const validated = await pipeline.validateAndHash(
        file.path,
        file.originalname,
        policy,
      );
      const promoted = await pipeline.promote(validated, policy);

      file.path = promoted.absolutePath;
      file.filename = path.basename(promoted.absolutePath);
      (file as SecureMulterFile).storageMeta = {
        storageKey: promoted.storageKey,
        storageProvider: promoted.provider,
        originalFilename: promoted.originalFilename,
        verifiedMimeType: promoted.verifiedMimeType,
        sizeBytes: promoted.sizeBytes,
        checksum: promoted.checksum,
        checksumAlgorithm: promoted.checksumAlgorithm,
      };

      registerPromotedUpload(req, promoted.storageKey, provider);
    }

    const anyReq = req as { __dl2TempDir?: string };
    if (anyReq.__dl2TempDir) {
      const dir = anyReq.__dl2TempDir;
      delete anyReq.__dl2TempDir;
      // Files were renamed out; remove the now-empty per-request directory.
      await provider.removeTemporaryDir(dir);
    }
  }

  function compose(parser: RequestHandler, policy: UploadPolicy): RequestHandler {
    return (req, res, next) => {
      parser(req, res, (err) => {
        if (err) {
          void cleanupRequestUploads(req, provider).finally(() =>
            next(mapMulterError(err)),
          );
          return;
        }
        promoteFiles(req, policy)
          .then(() => next())
          .catch((error) => {
            void cleanupRequestUploads(req, provider).finally(() =>
              next(mapMulterError(error)),
            );
          });
      });
    };
  }

  function factory(policyInput: UploadPolicyName | UploadPolicy): SecureUpload {
    const policy = resolvePolicy(policyInput);
    const instance = multer({
      storage,
      limits: {
        fileSize: policy.maxBytes,
        files: policy.maxFiles,
      },
    });
    return {
      single: (field) => compose(instance.single(field), policy),
      fields: (fields) => compose(instance.fields(fields), policy),
      any: () => compose(instance.any(), policy),
    };
  }

  return factory;
}

/** Application-wide secure upload bound to the default local provider. */
export const secureUpload: SecureUploadFactory = createSecureUpload(storageProvider);

/** Compatibility default: permissive category used by legacy shared routes. */
export const upload: SecureUpload = secureUpload("defense-evidence");
