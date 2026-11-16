import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { decodeOfficialFormSignature } from "./official-form-signature";

export const SIGNATURE_CAPTURE_METHODS = ["DRAW", "UPLOAD"] as const;
export type SignatureCaptureMethod = (typeof SIGNATURE_CAPTURE_METHODS)[number];

export interface UserSignatureVaultDto {
  hasSignature: boolean;
  signatureData: string | null;
  method: SignatureCaptureMethod | null;
  version: number;
  updatedAt: string | null;
}

export function emptyUserSignatureVault(): UserSignatureVaultDto {
  return {
    hasSignature: false,
    signatureData: null,
    method: null,
    version: 0,
    updatedAt: null,
  };
}

function normalizeMethod(raw: unknown): SignatureCaptureMethod {
  if (raw === undefined || raw === null || raw === "") {
    return "DRAW";
  }
  if (typeof raw !== "string") {
    throw new AppError("Signature method must be DRAW or UPLOAD.", 400);
  }
  const upper = raw.trim().toUpperCase();
  if ((SIGNATURE_CAPTURE_METHODS as readonly string[]).includes(upper)) {
    return upper as SignatureCaptureMethod;
  }
  throw new AppError("Signature method must be DRAW or UPLOAD.", 400);
}

function validateVaultSignature(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AppError("Signature image data is required.", 400);
  }
  const trimmed = raw.trim();
  try {
    decodeOfficialFormSignature(trimmed);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.statusCode === 413 ? 413 : 400;
      throw new AppError(err.message, status);
    }
    throw new AppError("Invalid signature image format.", 400);
  }
  return trimmed;
}

function toDto(record: {
  signatureData: string;
  method: string;
  version: number;
  updatedAt: Date;
}): UserSignatureVaultDto {
  const method = (SIGNATURE_CAPTURE_METHODS as readonly string[]).includes(
    record.method,
  )
    ? (record.method as SignatureCaptureMethod)
    : "DRAW";
  return {
    hasSignature: true,
    signatureData: record.signatureData,
    method,
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class UserSignatureService {
  constructor(private readonly db: any = prisma) {}

  async getVault(userId: string): Promise<UserSignatureVaultDto> {
    if (!userId) {
      throw new AppError("Authenticated user identity is required.", 401);
    }
    const existing = await this.db.userSignature.findUnique({
      where: { userId },
      select: {
        signatureData: true,
        method: true,
        version: true,
        updatedAt: true,
      },
    });
    if (!existing) {
      return emptyUserSignatureVault();
    }
    return toDto(existing);
  }

  async saveVault(
    userId: string,
    input: { signatureData?: unknown; method?: unknown },
  ): Promise<UserSignatureVaultDto> {
    if (!userId) {
      throw new AppError("Authenticated user identity is required.", 401);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new AppError("Invalid signature payload.", 400);
    }

    const signatureData = validateVaultSignature(input.signatureData);
    const method = normalizeMethod(input.method);

    const saved = await this.db.$transaction(async (tx: any) => {
      const existing = await tx.userSignature.findUnique({
        where: { userId },
        select: { id: true, version: true, method: true },
      });

      const nextVersion = existing ? existing.version + 1 : 1;
      const record = existing
        ? await tx.userSignature.update({
            where: { userId },
            data: {
              signatureData,
              method,
              version: nextVersion,
            },
            select: {
              id: true,
              signatureData: true,
              method: true,
              version: true,
              updatedAt: true,
            },
          })
        : await tx.userSignature.create({
            data: {
              userId,
              signatureData,
              method,
              version: 1,
            },
            select: {
              id: true,
              signatureData: true,
              method: true,
              version: true,
              updatedAt: true,
            },
          });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actionType: "USER_SIGNATURE_SAVED",
          targetTable: "user_signatures",
          targetId: record.id,
          oldValue: existing
            ? JSON.stringify({ version: existing.version, method: existing.method })
            : null,
          newValue: JSON.stringify({ version: record.version, method: record.method }),
          description: existing
            ? `Updated saved profile e-signature to version ${record.version} (${record.method}).`
            : `Created saved profile e-signature version 1 (${record.method}).`,
        },
      });

      return record;
    });

    return toDto(saved);
  }

  async deleteVault(userId: string): Promise<UserSignatureVaultDto> {
    if (!userId) {
      throw new AppError("Authenticated user identity is required.", 401);
    }

    await this.db.$transaction(async (tx: any) => {
      const existing = await tx.userSignature.findUnique({
        where: { userId },
        select: { id: true, version: true, method: true },
      });
      if (!existing) {
        return;
      }

      await tx.userSignature.delete({
        where: { userId },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actionType: "USER_SIGNATURE_DELETED",
          targetTable: "user_signatures",
          targetId: existing.id,
          oldValue: JSON.stringify({
            version: existing.version,
            method: existing.method,
          }),
          newValue: null,
          description: `Removed saved profile e-signature (version ${existing.version}).`,
        },
      });
    });

    return emptyUserSignatureVault();
  }
}
