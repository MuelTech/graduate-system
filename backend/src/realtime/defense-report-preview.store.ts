import type { PrismaClient } from "@prisma/client";

import prisma from "../config/database";
import type { DefenseReportPreviewStore } from "./defense-report-preview.authorization";
import { createPrismaDefenseRealtimeStore } from "./defense-realtime.store";

/**
 * CDW-LIVE-1A — narrow Prisma read port for report preview authorization.
 *
 * These are transport authorization reads only: exact schedule status, exact
 * current assignment role, and the report's lifecycle state. No report body is
 * selected, and nothing is written.
 */
export function createPrismaDefenseReportPreviewStore(
  client: PrismaClient = prisma,
): DefenseReportPreviewStore {
  const membership = createPrismaDefenseRealtimeStore(client);

  return {
    getSessionStatus: membership.getSessionStatus,
    listAssignedUserIds: membership.listAssignedUserIds,

    async getReportPreviewSenderState(scheduleId, userId) {
      const schedule = await client.defenseSchedule.findUnique({
        where: { id: scheduleId },
        select: {
          sessionStatus: true,
          panelAssignments: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
          rapReports: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, frozenAt: true },
          },
        },
      });

      if (!schedule) return null;

      const rap = schedule.rapReports[0] ?? null;

      return {
        sessionStatus: String(schedule.sessionStatus),
        role: schedule.panelAssignments[0]
          ? String(schedule.panelAssignments[0].role)
          : null,
        rapStatus: rap ? String(rap.status) : null,
        rapFrozenAt: rap?.frozenAt ?? null,
      };
    },
  };
}
