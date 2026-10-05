import prisma from "../config/database";
import {
  humanizeAuditAction,
  type DegreeLevel,
  type EnrolledStudentInput,
  type ThesisRecordInput,
} from "../services/admin-dashboard.rules";

export interface UpcomingDefenseRow {
  scheduleId: string;
  studentName: string;
  studentNumber: string | null;
  programName: string;
  defenseType: string;
  /** Wall-clock date `YYYY-MM-DD` (no timezone conversion). */
  defenseDate: string;
  /** Wall-clock time `HH:mm` (no timezone conversion). */
  defenseTime: string;
  venueOrLink: string | null;
  sessionStatus: string;
}

export interface RecentActivityRow {
  actor: string;
  action: string;
  detail: string | null;
  time: string;
}

function toWallClockDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function toWallClockTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(11, 16);
}

/**
 * Read-only Admin dashboard data source.
 *
 * Every method is a projection of existing authoritative records. No mutating
 * or workflow-changing query belongs here.
 */
export class DashboardRepository {
  /** Authoritative enrolled population (AdmissionStatus = ENROLLED). */
  async getEnrolledStudents(): Promise<EnrolledStudentInput[]> {
    const rows = await prisma.student.findMany({
      where: { admissionStatus: "ENROLLED" },
      select: { program: { select: { programName: true, programType: true } } },
    });
    return rows.map((row) => ({
      programName: row.program.programName,
      programType: row.program.programType as DegreeLevel,
    }));
  }

  /** All thesis records, newest-first per student, for pipeline derivation. */
  async getThesisRecordsForPipeline(): Promise<ThesisRecordInput[]> {
    const rows = await prisma.thesisRecord.findMany({
      select: { studentId: true, stage: true, createdAt: true, id: true },
      orderBy: [{ studentId: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => ({
      studentId: row.studentId,
      stage: row.stage,
      createdAt: row.createdAt,
      id: row.id,
    }));
  }

  async getBridgingWaiversToReviewCount(): Promise<number> {
    return prisma.applicantBridgingWaiver.count({
      where: { status: "PENDING" },
    });
  }

  /**
   * Dean-review queue shares the exact semantics of the Adviser Request Review
   * page: request is pending, adviser has CONFORME, Dean decision still pending.
   */
  async getAdviserRequestsForDeanReviewCount(): Promise<number> {
    return prisma.adviserRequest.count({
      where: {
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
    });
  }

  /** Live sessions waiting on the authorized session authority to conclude. */
  async getDefensesAwaitingConclusionCount(): Promise<number> {
    return prisma.defenseSchedule.count({
      where: { sessionStatus: "AWAITING_CONCLUSION" },
    });
  }

  /** RAP reports still collecting required signatures (not yet finalized). */
  async getRapReportsAwaitingSignaturesCount(): Promise<number> {
    return prisma.rapReport.count({
      where: { status: { in: ["FOR_SIGNATURE", "PARTIALLY_SIGNED"] } },
    });
  }

  /**
   * Next scheduled defenses. Excludes cancelled and concluded sessions and any
   * session dated before today. `defenseDate` is a MySQL DATE; the lower bound
   * is anchored at UTC midnight so the comparison matches stored wall-clock
   * dates regardless of server timezone.
   */
  async getUpcomingDefenses(
    limit = 5,
    now: Date = new Date(),
  ): Promise<UpcomingDefenseRow[]> {
    const startOfToday = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );

    const rows = await prisma.defenseSchedule.findMany({
      where: {
        sessionStatus: { notIn: ["CANCELLED", "CONCLUDED"] },
        defenseDate: { gte: startOfToday },
      },
      orderBy: [{ defenseDate: "asc" }, { defenseTime: "asc" }],
      take: limit,
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      scheduleId: row.id,
      studentName: `${row.thesis.student.user.firstName} ${row.thesis.student.user.lastName}`.trim(),
      studentNumber: row.thesis.student.studentNumber ?? null,
      programName: row.thesis.student.program.programName,
      defenseType: row.defenseType,
      defenseDate: toWallClockDate(row.defenseDate),
      defenseTime: toWallClockTime(row.defenseTime),
      venueOrLink: row.venueOrLink ?? null,
      sessionStatus: row.sessionStatus,
    }));
  }

  /**
   * Recent audit activity with internal action codes humanized. Never exposes
   * a raw internal code as the user-facing sentence.
   */
  async getRecentActivity(limit = 6): Promise<RecentActivityRow[]> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { firstName: true, lastName: true } } },
      take: limit,
    });

    return logs.map((log) => {
      const { action, detail } = humanizeAuditAction(
        log.actionType,
        log.description,
      );
      return {
        actor: log.actor
          ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
          : "System",
        action,
        detail,
        time: log.createdAt.toISOString(),
      };
    });
  }
}
