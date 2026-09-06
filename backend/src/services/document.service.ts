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

        // Verify the requesting user is active (not dismissed/graduated)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
        });
        if (!user || user.isActive === false) {
            throw new AppError("Account is not active", 403);
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
            // Log unauthorized access attempt
            await prisma.auditLog.create({
                data: {
                    actorId: userId,
                    actionType: "DOCUMENT_ACCESS_DENIED",
                    targetTable: config.prismaModel,
                    targetId: id,
                    description: `Unauthorized document access attempt by ${userRole}`,
                },
            }).catch(() => {}); // Best-effort — do not fail the request over logging
            throw new AppError("Not authorized to view this document", 403);
        }

        // Extract file path
        const storedPath = record[config.fileField];
        if (!storedPath) {
            throw new AppError("No file attached to this document", 404);
        }

        // Resolve the stored path relative to PRIVATE_UPLOAD_ROOT
        let resolvedPath = path.isAbsolute(storedPath)
            ? storedPath
            : path.join(PRIVATE_UPLOAD_ROOT, path.basename(storedPath));

        // Resolve symlinks via realpath to prevent symlink escapes
        try {
            resolvedPath = await fs.realpath(resolvedPath);
        } catch {
            throw new AppError("File not found on disk", 404);
        }

        // Validate that resolved path stays within PRIVATE_UPLOAD_ROOT
        const realUploadRoot = await fs.realpath(PRIVATE_UPLOAD_ROOT);
        const relative = path.relative(realUploadRoot, resolvedPath);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new AppError("Access denied", 403);
        }

        // Detect MIME type from extension
        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeType = MIME_MAP[ext] || "application/octet-stream";

        // Original filename from record or fallback
        const originalFilename = record.originalFilename || record.filename || path.basename(resolvedPath);

        // Log successful document view (best-effort)
        await prisma.auditLog.create({
            data: {
                actorId: userId,
                actionType: "DOCUMENT_VIEW",
                targetTable: config.prismaModel,
                targetId: id,
                description: `Document viewed: ${originalFilename}`,
            },
        }).catch(() => {});

        return { filePath: resolvedPath, mimeType, originalFilename };
    }
}
