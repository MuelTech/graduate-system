import prisma from "../config/database";
import type {
  CommitteeAssignmentInput,
  DefensePanelRole,
} from "../interfaces/defense-committee.interfaces";
import { mapProgramType } from "../interfaces/defense-committee.interfaces";
import type { DefenseTypeName } from "../interfaces/defense-eligibility.interfaces";
import { AppError } from "../utils/AppError";
import { requireSingleActiveAdviser } from "./active-adviser.rules";
import {
  DEFENSE_AUDIT_ACTIONS,
  buildDefenseScheduleAuditSnapshot,
  writeDefenseScheduleAudit,
  type DefenseScheduleAuditSnapshot,
} from "./defense-audit";
import { DefenseCommitteePolicy } from "./defense-committee.policy";

export interface CorrectScheduledDefenseInput {
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  assignments: CommitteeAssignmentInput[];
}

const EDITABLE_ROLES = new Set<DefensePanelRole>([
  "CHAIRMAN",
  "PANELIST",
  "RAPPORTEUR",
  "FACILITATOR",
]);

function requireDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("A valid defense date is required.", 400);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("A valid defense date is required.", 400);
  }
  return parsed;
}

function requireTime(value: unknown): Date {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new AppError("A valid defense time is required.", 400);
  }
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function requireVenue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("Venue / Meeting Details is required.", 400);
  }
  return value.trim();
}

function normalizeAssignments(value: unknown): CommitteeAssignmentInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("A corrected defense committee is required.", 400);
  }

  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new AppError("Each committee assignment is invalid.", 400);
    }
    const record = raw as Record<string, unknown>;
    const userId =
      typeof record.userId === "string" ? record.userId.trim() : "";
    const role = String(record.role ?? "").toUpperCase() as DefensePanelRole;

    if (!userId) {
      throw new AppError("Each committee assignment requires a user.", 400);
    }
    if (role === "ADVISER") {
      throw new AppError(
        "The Proposal/Final Adviser is assigned automatically and cannot be edited.",
        400,
      );
    }
    if (!EDITABLE_ROLES.has(role)) {
      throw new AppError(`Role ${role || "(missing)"} is not editable.`, 400);
    }
    return { userId, role };
  });
}

export class DefenseScheduleCorrectionService {
  private readonly committeePolicy = new DefenseCommitteePolicy();

  async correctSchedule(
    scheduleId: string,
    adminId: string,
    input: CorrectScheduledDefenseInput,
  ): Promise<DefenseScheduleAuditSnapshot> {
    if (!scheduleId) throw new AppError("Defense schedule not found.", 404);
    if (!adminId) throw new AppError("Admin access is required.", 403);

    const defenseDate = requireDate(input?.defenseDate);
    const defenseTime = requireTime(input?.defenseTime);
    const venueOrLink = requireVenue(input?.venueOrLink);
    const submitted = normalizeAssignments(input?.assignments);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT schedule_id FROM defense_schedules WHERE schedule_id = ${scheduleId} FOR UPDATE`;

      const schedule = await tx.defenseSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          conclusion: { select: { id: true } },
          thesis: {
            select: {
              student: {
                select: {
                  id: true,
                  program: { select: { programType: true } },
                },
              },
            },
          },
          panelAssignments: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });
      if (!schedule) throw new AppError("Defense schedule not found.", 404);

      if (
        String(schedule.sessionStatus) !== "SCHEDULED" ||
        schedule.conclusion
      ) {
        throw new AppError(
          "Defense schedule and committee can only be corrected while the session is SCHEDULED.",
          409,
        );
      }

      const defenseType = String(schedule.defenseType) as DefenseTypeName;
      const programType = mapProgramType(
        schedule.thesis?.student?.program?.programType ?? null,
      );

      let adviserUserId: string | null = null;
      let fullCommittee = submitted;
      if (defenseType !== "TITLE_DEFENSE") {
        const studentId = schedule.thesis?.student?.id;
        if (!studentId) {
          throw new AppError(
            "The student's active adviser relationship could not be resolved.",
            409,
          );
        }
        const adviserRows = await tx.adviserAssignment.findMany({
          where: { studentId, isActive: true },
          select: { id: true, adviserId: true },
          orderBy: { assignedDate: "desc" },
        });
        const activeAdviser = requireSingleActiveAdviser(adviserRows);
        if (!activeAdviser) {
          throw new AppError(
            "Proposal/Final Defense requires an active thesis adviser relationship.",
            400,
          );
        }
        adviserUserId = activeAdviser.adviserId;
        fullCommittee = [
          ...submitted,
          { userId: adviserUserId, role: "ADVISER" },
        ];
      }

      const validation = this.committeePolicy.validateAssignments(
        defenseType,
        programType,
        fullCommittee,
        { adviserUserId },
      );
      if (!validation.valid) {
        throw new AppError(validation.errors.join(" "), 400);
      }

      const activeBefore = schedule.panelAssignments.filter(
        (assignment) => assignment.isActive,
      );
      const before = buildDefenseScheduleAuditSnapshot({
        ...schedule,
        panelAssignments: activeBefore,
      });

      await tx.defenseSchedule.update({
        where: { id: scheduleId },
        data: { defenseDate, defenseTime, venueOrLink },
      });

      const desiredUserIds = new Set(fullCommittee.map((row) => row.userId));
      const removed = activeBefore.filter(
        (assignment) => !desiredUserIds.has(assignment.userId),
      );
      if (removed.length > 0) {
        await tx.panelAssignment.updateMany({
          where: {
            scheduleId,
            isActive: true,
            userId: { notIn: [...desiredUserIds] },
          },
          data: { isActive: false },
        });
      }

      const existingByUserId = new Map(
        schedule.panelAssignments.map((assignment) => [
          assignment.userId,
          assignment,
        ]),
      );
      for (const assignment of fullCommittee) {
        const existing = existingByUserId.get(assignment.userId);
        if (!existing) {
          await tx.panelAssignment.create({
            data: {
              scheduleId,
              userId: assignment.userId,
              role: assignment.role,
              isActive: true,
            },
          });
        } else if (
          !existing.isActive ||
          String(existing.role) !== assignment.role
        ) {
          await tx.panelAssignment.update({
            where: { id: existing.id },
            data: { role: assignment.role, isActive: true },
          });
        }
      }

      const afterAssignments = await tx.panelAssignment.findMany({
        where: { scheduleId, isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const after = buildDefenseScheduleAuditSnapshot({
        ...schedule,
        defenseDate,
        defenseTime,
        venueOrLink,
        panelAssignments: afterAssignments,
      });

      await writeDefenseScheduleAudit(tx, {
        actorId: adminId,
        actionType: DEFENSE_AUDIT_ACTIONS.SCHEDULE_CORRECTED,
        before,
        after,
      });

      return after;
    });
  }
}
