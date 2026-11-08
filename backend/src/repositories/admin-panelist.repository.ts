import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";

/**
 * Patch-safe panelist flag resolution.
 * Omitted fields keep current values; external always forces availability off.
 */
export function resolvePanelistAdviserFlags(
  data: {
    isExternal?: boolean;
    isAvailableAsAdviser?: boolean;
  },
  current: { isExternal: boolean; isAvailableAsAdviser: boolean },
): { isExternal: boolean; isAvailableAsAdviser: boolean } {
  const isExternal =
    typeof data.isExternal === "boolean" ? data.isExternal : current.isExternal;
  const requestedAvailability =
    typeof data.isAvailableAsAdviser === "boolean"
      ? data.isAvailableAsAdviser
      : current.isAvailableAsAdviser;
  return {
    isExternal,
    isAvailableAsAdviser: isExternal ? false : requestedAvailability,
  };
}

/** Internal validation projection. Public DTOs are explicitly assembled by the service. */
export const FACULTY_PROFILE_SELECT = {
    id: true, userId: true, highestEducationalAttainment: true, officeAffiliation: true, specialization: true,
    isExternal: true, isAvailableAsAdviser: true, isActive: true, createdAt: true,
    user: { select: {
        id: true, role: true, email: true, firstName: true, lastName: true, title: true, suffix: true,
        isActive: true, createdAt: true, updatedAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
        updatedBy: { select: { firstName: true, lastName: true } },
        administratorAccess: { select: { level: true } }, capabilityGrants: { select: { capabilityKey: true } },
    } },
} as const satisfies Prisma.PanelistSelect;
export type FacultyProfile = Prisma.PanelistGetPayload<{ select: typeof FACULTY_PROFILE_SELECT }>;

export class AdminPanelistRepository {
    constructor(private readonly db: Pick<Prisma.TransactionClient, "panelist" | "user"> = prisma) {}
    findAll() {
        return this.db.panelist.findMany({ where: { user: { role: { in: ["FACULTY", "PANELIST"] } } },
            select: FACULTY_PROFILE_SELECT, orderBy: { createdAt: "desc" } });
    }
    findById(id: string) { return this.db.panelist.findUnique({ where: { id }, select: FACULTY_PROFILE_SELECT }); }

    /** Retired alternate writers: all configuration must enter the audited capability service. */
    async createWithUserTransaction(_data: unknown, _passwordHash: string, _adminId: string): Promise<never> {
        throw new AppError("Use Faculty configuration to manage academic accounts.", 403);
    }
    async updateWithUserTransaction(_id: string, _data: unknown, _adminId: string, _passwordHash?: string): Promise<never> {
        throw new AppError("Use Faculty configuration to manage academic accounts.", 403);
    }
}
