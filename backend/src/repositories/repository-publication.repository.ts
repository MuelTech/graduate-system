import prisma from "../config/database";

/**
 * DL-10: Research Repository publication projection.
 *
 * The Repository is a public/discovery surface derived from private Databank
 * archives. This repository never returns raw storage paths, respondent data,
 * internal thesis documents/certifications, signatures, checksums, or internal
 * user/thesis identifiers. Legacy `ELibrary` rows are the temporary persistence
 * for publication state (`isPublic`, `publishedAt`, `approvedById`).
 *
 * The Databank archival registration authority remains DL-9
 * (`DatabankArchiveRepository`); this file only projects/transitions the
 * publication state.
 */

/** Row shape for the public projection (no student number, no paths). */
export interface PublishedEntryRow {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  publishedAt: Date | null;
  thesis: {
    student: {
      user: { firstName: string; lastName: string } | null;
      program: { programName: string } | null;
    } | null;
  } | null;
}

/** Row shape for the ADMIN-only publication queue (adds student number). */
export interface AdminEntryRow {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  isPublic: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  thesis: {
    student: {
      studentNumber: string | null;
      user: { firstName: string; lastName: string } | null;
      program: { programName: string } | null;
    } | null;
  } | null;
}

export interface PublicationState {
  id: string;
  isPublic: boolean;
}

const PUBLISHED_SELECT = {
  id: true,
  title: true,
  abstract: true,
  keywords: true,
  publishedAt: true,
  thesis: {
    select: {
      student: {
        select: {
          user: { select: { firstName: true, lastName: true } },
          program: { select: { programName: true } },
        },
      },
    },
  },
} as const;

const ADMIN_SELECT = {
  id: true,
  title: true,
  abstract: true,
  keywords: true,
  isPublic: true,
  publishedAt: true,
  createdAt: true,
  thesis: {
    select: {
      student: {
        select: {
          studentNumber: true,
          user: { select: { firstName: true, lastName: true } },
          program: { select: { programName: true } },
        },
      },
    },
  },
} as const;

export class RepositoryPublicationRepository {
  /**
   * Public list. `isPublic: true` is always enforced; the caller's auth role is
   * irrelevant and is never inspected here.
   */
  async searchPublished(
    searchQuery?: string,
  ): Promise<PublishedEntryRow[]> {
    return prisma.eLibrary.findMany({
      where: {
        isPublic: true,
        ...(searchQuery
          ? {
              OR: [
                { title: { contains: searchQuery } },
                { keywords: { contains: searchQuery } },
                {
                  thesis: {
                    student: {
                      user: {
                        OR: [
                          { firstName: { contains: searchQuery } },
                          { lastName: { contains: searchQuery } },
                        ],
                      },
                    },
                  },
                },
                {
                  thesis: {
                    student: {
                      program: { programName: { contains: searchQuery } },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: PUBLISHED_SELECT,
      orderBy: { publishedAt: "desc" },
    });
  }

  /** Public detail; private rows are indistinguishable from missing rows. */
  async findPublishedById(id: string): Promise<PublishedEntryRow | null> {
    return prisma.eLibrary.findFirst({
      where: { id, isPublic: true },
      select: PUBLISHED_SELECT,
    });
  }

  /** ADMIN publication queue. */
  async findAllForAdmin(): Promise<AdminEntryRow[]> {
    return prisma.eLibrary.findMany({
      select: ADMIN_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async findAdminById(id: string): Promise<AdminEntryRow | null> {
    return prisma.eLibrary.findUnique({
      where: { id },
      select: ADMIN_SELECT,
    });
  }

  /** Minimal state probe for publish/unpublish conflict detection. */
  async getPublicationState(id: string): Promise<PublicationState | null> {
    return prisma.eLibrary.findUnique({
      where: { id },
      select: { id: true, isPublic: true },
    });
  }

  /**
   * Conditional private -> public transition. Returns the number of rows
   * changed (0 when the row is missing or already public), which the service
   * maps to a controlled 404/409. Only publication fields are written.
   */
  async publishIfPrivate(
    id: string,
    adminId: string,
    publishedAt: Date,
  ): Promise<number> {
    const result = await prisma.eLibrary.updateMany({
      where: { id, isPublic: false },
      data: {
        isPublic: true,
        publishedAt,
        approvedById: adminId,
      },
    });
    return result.count;
  }

  /**
   * Conditional public -> private transition. Unpublish removes the entry from
   * the Repository only; the private archive row and any files are untouched.
   */
  async unpublishIfPublic(id: string): Promise<number> {
    const result = await prisma.eLibrary.updateMany({
      where: { id, isPublic: true },
      data: { isPublic: false },
    });
    return result.count;
  }
}
