import prisma from "../config/database";

/**
 * ADV-2 — read-only Adviser workspace repository.
 *
 * The only relationship authority is the Student's active `AdviserAssignment`.
 * Queries deliberately select deliberate DTO fields: no raw document rows,
 * evaluator records, signatures, COR, receipts, or account data.
 */

const ACTIVE_ADVISEE_STUDENT_SELECT = {
  id: true,
  studentNumber: true,
  user: { select: { firstName: true, lastName: true } },
  program: { select: { programName: true } },
  thesisRecords: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, stage: true, status: true },
  },
} as const;

export type AdviserWorkspaceStudentRow = {
  id: string;
  studentNumber: string | null;
  user: { firstName: string; lastName: string };
  program: { programName: string } | null;
  thesisRecords: Array<{ id: string; stage: string; status: string }>;
};

export type AdviserActiveAssignmentRow = {
  id: string;
  studentId: string;
  adviserId: string;
  assignedDate: Date;
  student: AdviserWorkspaceStudentRow;
};

/** Minimal row used to validate every candidate Student's full active set. */
export type AdviserStudentActiveAssignmentRow = {
  id: string;
  studentId: string;
  adviserId: string;
  assignedDate: Date;
};

export type AdviserDetailStudentRow = {
  id: string;
  studentNumber: string | null;
  user: { firstName: string; lastName: string };
  program: { programName: string } | null;
  adviserAssignments: Array<{
    id: string;
    adviserId: string;
    assignedDate: Date;
  }>;
  thesisRecords: Array<{ id: string; stage: string; status: string }>;
};

/** ADV-5: safe academic research-document metadata only. */
export type AdviserResearchDocumentRow = {
  id: string;
  docType: string;
  defenseStage: string | null;
  uploadedAt: Date;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
};

/** ADV-5: narrow concluded-attempt projection. */
export type AdviserDefenseHistoryRow = {
  id: string;
  defenseType: string;
  defenseDate: Date;
  manuscriptDocumentId: string | null;
  conclusion: { outcome: string; concludedAt: Date } | null;
  manuscriptDocument: {
    id: string;
    thesisId: string;
    docType: string;
    defenseStage: string | null;
    uploadedAt: Date;
  } | null;
  rapReports: Array<{
    status: string;
    finalizedAt: Date | null;
    bodyDocument: unknown;
    decisionsAndRecommendations: string | null;
  }>;
};

export class AdviserWorkspaceRepository {
  /** Active advisees for exactly one authenticated Adviser. */
  async listActiveAssignmentsForAdviser(
    adviserId: string,
  ): Promise<AdviserActiveAssignmentRow[]> {
    return prisma.adviserAssignment.findMany({
      where: { adviserId, isActive: true },
      include: { student: { select: ACTIVE_ADVISEE_STUDENT_SELECT } },
      orderBy: { assignedDate: "desc" },
    }) as unknown as Promise<AdviserActiveAssignmentRow[]>;
  }

  /**
   * All active AdviserAssignments for the candidate Students, in one bounded
   * query. This detects duplicate active authority even when the second row
   * belongs to a different Adviser.
   */
  async listActiveAdviserAssignmentsForStudents(
    studentIds: string[],
  ): Promise<AdviserStudentActiveAssignmentRow[]> {
    const ids = Array.from(new Set(studentIds.filter(Boolean)));
    if (ids.length === 0) return [];
    return prisma.adviserAssignment.findMany({
      where: { studentId: { in: ids }, isActive: true },
      select: {
        id: true,
        studentId: true,
        adviserId: true,
        assignedDate: true,
      },
    });
  }

  /**
   * Exact advisee lookup. Active assignments are loaded only for the
   * authorization decision; they are never returned as a public relation.
   */
  async findStudentForAdviseeDetail(
    studentId: string,
  ): Promise<AdviserDetailStudentRow | null> {
    return prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentNumber: true,
        user: { select: { firstName: true, lastName: true } },
        program: { select: { programName: true } },
        adviserAssignments: {
          where: { isActive: true },
          select: { id: true, adviserId: true, assignedDate: true },
        },
        thesisRecords: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, stage: true, status: true },
        },
      },
    }) as unknown as Promise<AdviserDetailStudentRow | null>;
  }

  /**
   * ADV-5: academic research documents for the current advisee. The query is
   * filtered at the database boundary to the Adviser academic allow-list.
   * Callers must authorize the active-Adviser relationship before calling.
   */
  async listAdviserResearchDocuments(
    thesisId: string,
  ): Promise<AdviserResearchDocumentRow[]> {
    return prisma.thesisDocument.findMany({
      where: {
        thesisId,
        docType: {
          in: ["TITLE_PROPOSAL", "PROPOSAL_CHAPTERS", "FINAL_MANUSCRIPT"],
        },
      },
      select: {
        id: true,
        docType: true,
        defenseStage: true,
        uploadedAt: true,
        isCurrent: true,
        supersedesDocumentId: true,
      },
      orderBy: { uploadedAt: "desc" },
    }) as unknown as Promise<AdviserResearchDocumentRow[]>;
  }

  /**
   * ADV-5: concluded same-thesis attempts. Only the exact attempt binding and a
   * FINALIZED Committee Report are selected; evaluator/signature relations are
   * deliberately absent.
   */
  async listAdviserDefenseHistory(
    thesisId: string,
  ): Promise<AdviserDefenseHistoryRow[]> {
    return prisma.defenseSchedule.findMany({
      where: {
        thesisId,
        conclusion: { isNot: null },
      },
      select: {
        id: true,
        defenseType: true,
        defenseDate: true,
        manuscriptDocumentId: true,
        conclusion: {
          select: { outcome: true, concludedAt: true },
        },
        manuscriptDocument: {
          select: {
            id: true,
            thesisId: true,
            docType: true,
            defenseStage: true,
            uploadedAt: true,
          },
        },
        rapReports: {
          where: { status: "FINALIZED" },
          orderBy: { finalizedAt: "desc" },
          take: 1,
          select: {
            status: true,
            finalizedAt: true,
            bodyDocument: true,
            decisionsAndRecommendations: true,
          },
        },
      },
      orderBy: { defenseDate: "desc" },
    }) as unknown as Promise<AdviserDefenseHistoryRow[]>;
  }
}
