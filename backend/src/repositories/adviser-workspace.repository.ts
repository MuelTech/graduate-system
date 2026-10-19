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
}
