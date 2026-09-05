// backend/src/services/document.service.ts
import path from "path";
import fs from "fs/promises";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { PRIVATE_UPLOAD_ROOT } from "../utils/file.utils";

interface ModelConfig {
  prismaModel: string;
  fileField: string;
  include?: Record<string, any>;
  getOwnerId: (record: any) => string | null;
  getExtraAuthCheck?: (record: any, userId: string, userRole: string) => boolean;
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "cor-upload": {
    prismaModel: "corUpload",
    fileField: "filePath",
    include: { student: { include: { user: true } } },
    getOwnerId: (r) => r.student?.user?.id ?? null,
  },
  "thesis-document": {
    prismaModel: "thesisDocument",
    fileField: "filePath",
    include: {
      thesis: {
        include: {
          student: { include: { user: true } },
          defenseSchedules: {
            include: {
              panelAssignments: true,
            },
          },
        },
      },
    },
    getOwnerId: (r) => r.thesis?.student?.user?.id ?? null,
    getExtraAuthCheck: (record, userId, userRole) => {
      if (userRole === "PANELIST") {
        return record.thesis?.defenseSchedules?.some((ds: any) =>
          ds.panelAssignments?.some((pa: any) => pa.userId === userId)
        ) ?? false;
      }
      return false;
    },
  },
  "rap-report": {
    prismaModel: "rapReport",
    fileField: "filePath",
    include: {},
    getOwnerId: () => null,
  },
  "student-requirement": {
    prismaModel: "studentRequirement",
    fileField: "filePath",
    include: { student: { include: { user: true } } },
    getOwnerId: (r) => r.student?.userId ?? null,
  },
  "plagiarism-result": {
    prismaModel: "plagiarismResult",
    fileField: "filePath",
    include: { thesis: { include: { student: { include: { user: true } } } } },
    getOwnerId: (r) => r.thesis?.student?.user?.id ?? null,
  },
};

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export class DocumentService {
  async resolveDocument(
    modelType: string,
    id: string,
    userId: string,
    userRole: string
  ): Promise<{ filePath: string; mimeType: string; originalFilename: string }> {
    const config = MODEL_REGISTRY[modelType];
    if (!config) {
      throw new AppError("Unknown document type", 400);
    }

    // Fetch record using raw prisma query to support dynamic model access
    const record = await (prisma as any)[config.prismaModel].findUnique({
      where: { id },
      include: config.include,
    });

    if (!record) {
      throw new AppError("Document not found", 404);
    }

    // Permission check: owner or authorized role
    const isOwner = config.getOwnerId(record) === userId;
    const isAdmin = userRole === "ADMIN";
    const hasExtraAuth = config.getExtraAuthCheck?.(record, userId, userRole) ?? false;

    if (!isOwner && !isAdmin && !hasExtraAuth) {
      throw new AppError("Not authorized to view this document", 403);
    }

    // Extract file path
    const relativePath = record[config.fileField];
    if (!relativePath) {
      throw new AppError("No file attached to this document", 404);
    }

    // Resolve and validate path
    const resolvedPath = path.resolve(relativePath);
    const relative = path.relative(PRIVATE_UPLOAD_ROOT, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError("Access denied", 403);
    }

    // Check file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new AppError("File not found on disk", 404);
    }

    // Detect MIME type
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    // Original filename from record or fallback
    const originalFilename = record.originalFilename || record.filename || path.basename(resolvedPath);

    return { filePath: resolvedPath, mimeType, originalFilename };
  }
}
