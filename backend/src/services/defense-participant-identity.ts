import type { Prisma } from "@prisma/client";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AppError } from "../utils/AppError";
import { EXTERNAL_ACTIVE_ADVISER_MESSAGE } from "./active-adviser.rules";

/**
 * DR-5 write-boundary identity check for Defense seats:
 * - Manual seats (CHAIRMAN, PANELIST, RAPPORTEUR, FACILITATOR) allow active Internal or External Faculty.
 * - Derived/submitted ADVISER seats must be active Internal Faculty (never External).
 */
export async function assertManualDefenseParticipants(
  tx: Pick<Prisma.TransactionClient, "user">,
  assignments: ReadonlyArray<{ userId: string; role: string }>,
): Promise<void> {
  const ids = [...new Set(assignments.map(row => row.userId))].sort();
  if (ids.some(id => typeof id !== "string" || !id.trim())) throw new AppError("Invalid committee participant.", 400);
  const users = await tx.user.findMany({ where: { id: { in: ids } },
    select: { id: true, role: true, isActive: true, panelist: { select: { isActive: true, isExternal: true } } } });
  const byId = new Map(users.map(user => [user.id, user]));
  if (ids.some(id => {
    const user = byId.get(id);
    return !user || !isAcademicAccountRole(user.role) || user.isActive !== true || user.panelist?.isActive !== true;
  })) throw new AppError("Each manually assigned committee participant must be active Faculty with an active academic profile.", 400);
  if (assignments.some(row => row.role === "ADVISER" && byId.get(row.userId)?.panelist?.isExternal === true)) {
    throw new AppError(EXTERNAL_ACTIVE_ADVISER_MESSAGE, 409);
  }
}
