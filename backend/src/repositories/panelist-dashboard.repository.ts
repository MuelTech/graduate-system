/**
 * UIUX-3A — Panelist dashboard read-model repository.
 *
 * Read-only projections of the authenticated panelist's own assignments and own
 * RAP signature slots. No mutation, no workflow transition, no cross-user data.
 */
import prisma from "../config/database";
import { isEvaluatorRole } from "../services/oral-evaluation.rules";
import type {
  DashboardAssignmentInput,
  DashboardRapSlotInput,
  DashboardSignedRapSlotInput,
} from "../services/panelist-dashboard.rules";

const PROPOSAL_DEFENSE = "PROPOSAL_DEFENSE";
const FINAL_DEFENSE = "FINAL_DEFENSE";

/** Stored wall-clock date (`YYYY-MM-DD`) without timezone conversion. */
function toWallDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Stored wall-clock time (`HH:mm:ss`) without timezone conversion. */
function toWallTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 19);
}

export class PanelistDashboardRepository {
  /** Own PanelAssignment rows enriched with authoritative session state. */
  async getAssignments(userId: string): Promise<DashboardAssignmentInput[]> {
    const rows = await prisma.panelAssignment.findMany({
      where: { userId },
      include: {
        // Own evaluation status only — scoped to this PanelAssignment.
        oralExamScores: { select: { panelId: true, status: true } },
        schedule: {
          include: {
            conclusion: { select: { id: true } },
            oralExamSummary: { select: { id: true } },
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
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => {
      const defenseType = String(row.schedule?.defenseType ?? "");
      const isNumerical =
        defenseType === PROPOSAL_DEFENSE || defenseType === FINAL_DEFENSE;
      let evaluationStatus: DashboardAssignmentInput["evaluationStatus"] =
        "NONE";
      if (isEvaluatorRole(String(row.role)) && isNumerical) {
        const ownScore = row.oralExamScores?.[0] ?? null;
        evaluationStatus =
          ownScore?.status === "FINALIZED"
            ? "FINALIZED"
            : ownScore?.status === "DRAFT"
              ? "DRAFT"
              : "NOT_STARTED";
      }
      const student = row.schedule?.thesis?.student;
      return {
        assignmentId: row.id,
        role: String(row.role),
        evaluationStatus,
        scheduleId: row.schedule?.id ?? "",
        defenseType,
        sessionStatus: String(row.schedule?.sessionStatus ?? ""),
        defenseDate: toWallDate(row.schedule?.defenseDate),
        defenseTime: toWallTime(row.schedule?.defenseTime),
        venueOrLink: row.schedule?.venueOrLink ?? null,
        conclusionPresent: Boolean(row.schedule?.conclusion),
        rapporteurNotesFinalized: Boolean(
          row.schedule?.rapporteurNotesFinalizedAt,
        ),
        oralSummaryReady: Boolean(row.schedule?.oralExamSummary),
        studentName: student
          ? `${student.user.firstName} ${student.user.lastName}`.trim()
          : "Student",
        studentNumber: student?.studentNumber ?? null,
        programName: student?.program?.programName ?? null,
      };
    });
  }

  /** Own unsigned, required RAP signature slots on a non-finalized RAP. */
  async getPendingRapSlots(userId: string): Promise<DashboardRapSlotInput[]> {
    const rows = await prisma.rapReportSignature.findMany({
      where: {
        userId,
        isSigned: false,
        required: { not: false },
        rapReport: { status: { in: ["FOR_SIGNATURE", "PARTIALLY_SIGNED"] } },
      },
      include: {
        rapReport: {
          select: {
            defenseType: true,
            generatedAt: true,
            thesis: {
              select: {
                student: {
                  select: {
                    studentNumber: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const student = row.rapReport?.thesis?.student;
      return {
        id: row.id,
        rapId: row.rapId,
        roleAtDefense: row.roleAtDefense ?? null,
        defenseType: String(row.rapReport?.defenseType ?? ""),
        generatedDate: toWallDate(row.rapReport?.generatedAt),
        studentName: student
          ? `${student.user.firstName} ${student.user.lastName}`.trim()
          : null,
        studentNumber: student?.studentNumber ?? null,
      };
    });
  }

  /**
   * Own already-signed slots whose RAP is still collecting other signatures.
   * The authenticated user has acted; the record now waits on other actors.
   */
  async getSignedRapSlots(
    userId: string,
  ): Promise<DashboardSignedRapSlotInput[]> {
    const rows = await prisma.rapReportSignature.findMany({
      where: {
        userId,
        isSigned: true,
        rapReport: { status: { in: ["FOR_SIGNATURE", "PARTIALLY_SIGNED"] } },
      },
      include: {
        rapReport: {
          select: {
            defenseType: true,
            thesis: {
              select: {
                student: {
                  select: {
                    studentNumber: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const student = row.rapReport?.thesis?.student;
      return {
        id: row.id,
        defenseType: String(row.rapReport?.defenseType ?? ""),
        studentName: student
          ? `${student.user.firstName} ${student.user.lastName}`.trim()
          : null,
        studentNumber: student?.studentNumber ?? null,
        signedDate: toWallDate(row.signedAt),
      };
    });
  }
}
