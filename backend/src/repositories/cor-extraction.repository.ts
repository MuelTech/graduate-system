import prisma from "../config/database";
import type { CorExtractionResult } from "../extraction/cor-extraction.types";

/**
 * DL-4: persistence for generic COR extraction results.
 *
 * Extraction state is stored separately from Admin-confirmed `CorRecord`
 * values. One row per CorUpload (`corUploadId` is unique), so reprocessing the
 * same upload updates its row and historical submissions are never touched by
 * processing a different upload.
 */
export class CorExtractionRepository {
  async upsertResult(corUploadId: string, result: CorExtractionResult) {
    const data = {
      status: result.status,
      method: result.method,
      extractorVersion: result.extractorVersion,
      pageCount: result.pageCount,
      text: result.text,
      pages: (result.pages ?? null) as never,
      suggestions: (result.suggestions ?? null) as never,
      diagnostic: result.diagnostic,
      processedAt: result.processedAt,
    };

    return prisma.corExtraction.upsert({
      where: { corUploadId },
      create: { corUploadId, ...data },
      update: data,
    });
  }

  async getByCorUploadId(corUploadId: string) {
    return prisma.corExtraction.findUnique({ where: { corUploadId } });
  }
}
