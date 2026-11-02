import prisma from "../config/database";
import type { Prisma } from "@prisma/client";

const mediaSelect = {
  id: true,
  storageKey: true,
  storageProvider: true,
  verifiedMimeType: true,
  sizeBytes: true,
  checksum: true,
  checksumAlgorithm: true,
} satisfies Prisma.ExamMediaSelect;

/** Storage metadata is internal to this repository and the media service. */
export class ExamMediaRepository {
  create(data: Prisma.ExamMediaCreateInput) {
    return prisma.examMedia.create({ data, select: { id: true } });
  }

  findForAdmin(id: string) {
    return prisma.examMedia.findUnique({ where: { id }, select: mediaSelect });
  }

  /** Internal failed-import compensation only; concurrent authoritative links win. */
  deleteUnreferenced(id: string, storageKey: string, storageProvider: string) {
    return prisma.examMedia.deleteMany({
      where: { id, storageKey, storageProvider, stimulusQuestions: { none: {} }, options: { none: {} }, revisionReferences: { none: {} } },
    });
  }

  findForApplicant(id: string, revisionId: string) {
    if (!revisionId) return null;
    return prisma.examMedia.findFirst({
      where: {
        id,
        revisionReferences: { some: { revisionId } },
      },
      select: mediaSelect,
    });
  }
}
