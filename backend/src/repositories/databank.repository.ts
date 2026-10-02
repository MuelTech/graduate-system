import prisma from "../config/database";

/**
 * DL-10: legacy ADMIN archive list only.
 *
 * The former generic public `searchPublic` / `findById` (full Thesis graph),
 * `createEntry` (client-supplied paths), and `updateEntry` (unconditional
 * publication/metadata mutation) helpers were removed. Retrieval and
 * publication now flow through `RepositoryPublicationRepository`, which
 * enforces `isPublic = true` and selects only safe fields.
 */
export class DatabankRepository {
  async findAll() {
    // DL-9: Admin list must not serialize legacy raw storage paths.
    return prisma.eLibrary.findMany({
      select: {
        id: true,
        thesisId: true,
        title: true,
        abstract: true,
        keywords: true,
        isPublic: true,
        publishedAt: true,
        approvedById: true,
        createdAt: true,
        thesis: {
          select: {
            id: true,
            student: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
                program: {
                  select: {
                    programName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
