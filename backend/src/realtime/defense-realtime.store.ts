import type { PrismaClient } from "@prisma/client";

import prisma from "../config/database";
import type { DefenseRealtimeAuthorizationStore } from "./defense-realtime.authorization";

/**
 * Prisma-backed transport authorization reads. These queries are intentionally
 * narrow: they resolve only the exact schedule status and current
 * PanelAssignment membership required by the realtime room rules.
 */
export function createPrismaDefenseRealtimeStore(
  client: PrismaClient = prisma,
): DefenseRealtimeAuthorizationStore {
  return {
    async getSessionStatus(scheduleId) {
      const schedule = await client.defenseSchedule.findUnique({
        where: { id: scheduleId },
        select: { sessionStatus: true },
      });

      return schedule?.sessionStatus ?? null;
    },

    async hasPanelAssignment(scheduleId, userId) {
      const assignment = await client.panelAssignment.findFirst({
        where: { scheduleId, userId, isActive: true },
        select: { id: true },
      });

      return assignment !== null;
    },

    async listAssignedUserIds(scheduleId, userIds) {
      const exactUserIds = Array.from(
        new Set(userIds.filter((userId) => userId.length > 0)),
      );

      if (exactUserIds.length === 0) {
        return new Set<string>();
      }

      const assignments = await client.panelAssignment.findMany({
        where: {
          scheduleId,
          userId: { in: exactUserIds },
          isActive: true,
        },
        select: { userId: true },
      });

      return new Set(assignments.map((assignment) => assignment.userId));
    },
  };
}
