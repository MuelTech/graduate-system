import prisma from "../config/database";

/**
 * DL-9: Research Databank private archival registration.
 *
 * Read/resolve the authenticated Student's completed Final research context and
 * persist a private archive record. No storage paths are read or written here;
 * the archival manuscript policy is unresolved, so archive rows are created
 * with null legacy path fields.
 */

export interface ArchiveRecord {
  id: string;
  thesisId: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  isPublic: boolean;
  publishedAt: Date | null;
  approvedById: string | null;
  createdAt: Date;
}

const ARCHIVE_SELECT = {
  id: true,
  thesisId: true,
  title: true,
  abstract: true,
  keywords: true,
  isPublic: true,
  publishedAt: true,
  approvedById: true,
  createdAt: true,
} as const;

export class DatabankArchiveRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  async getThesisIdsForStudent(studentId: string): Promise<string[]> {
    const rows = await prisma.thesisRecord.findMany({
      where: { studentId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Latest FORMAL Final Defense conclusion for one thesis (authority read). */
  async getFinalConclusionForThesis(thesisId: string) {
    return prisma.defenseConclusion.findFirst({
      where: {
        thesisId,
        schedule: { defenseType: "FINAL_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: {
        outcome: true,
        scheduleId: true,
        concludedAt: true,
        selectedTitleId: true,
      },
    });
  }

  /** FINALIZED RAP bound to the EXACT same Final schedule. */
  async getFinalizedRapForSchedule(scheduleId: string) {
    return prisma.rapReport.findFirst({
      where: {
        scheduleId,
        defenseType: "FINAL_DEFENSE",
        status: "FINALIZED",
      },
      select: { finalizedAt: true },
    });
  }

  /** Official title from the accepted Title Defense conclusion authority. */
  async getOfficialTitleForThesis(thesisId: string): Promise<string | null> {
    const titleConclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesisId,
        outcome: "PASSED",
        selectedTitleId: { not: null },
        schedule: { defenseType: "TITLE_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: { selectedTitleId: true },
    });
    if (!titleConclusion?.selectedTitleId) return null;
    const title = await prisma.thesisTitle.findUnique({
      where: { id: titleConclusion.selectedTitleId },
      select: { titleText: true },
    });
    return title?.titleText ?? null;
  }

  async getArchiveByThesisId(thesisId: string): Promise<ArchiveRecord | null> {
    return prisma.eLibrary.findUnique({
      where: { thesisId },
      select: ARCHIVE_SELECT,
    });
  }

  /**
   * Creates the private archive registration. Legacy path fields are explicitly
   * null; publication fields remain unset. `is_public` is false by schema
   * default and explicitly here (defense in depth).
   */
  async createArchive(data: {
    thesisId: string;
    title: string;
    abstract: string | null;
    keywords: string | null;
  }): Promise<ArchiveRecord> {
    return prisma.eLibrary.create({
      data: {
        thesisId: data.thesisId,
        title: data.title,
        abstract: data.abstract,
        keywords: data.keywords,
        fullPaperPath: null,
        respondentDataPath: null,
        isPublic: false,
        publishedAt: null,
        approvedById: null,
      },
      select: ARCHIVE_SELECT,
    });
  }
}
