import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { UserRole } from "@prisma/client";

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

const userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    title: true,
    suffix: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
        select: {
            firstName: true,
            lastName: true,
        },
    },
    updatedBy: {
        select: {
            firstName: true,
            lastName: true,
        },
    },
};

export class AdminPanelistRepository {
    async findAll() {
        return prisma.panelist.findMany({
            include: { user: { select: userSelect } },
            orderBy: { createdAt: "desc" },
        });
    }

    async findById(id: string) {
        return prisma.panelist.findUnique({
            where: { id },
            include: { user: { select: userSelect } },
        });
    }

    async checkEmailInUse(email: string) {
        return prisma.user.findUnique({ where: { email } });
    }

    async createWithUserTransaction(data: any, passwordHash: string, adminId: string) {
        return prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: data.email,
                    passwordHash,
                    title: data.title || null,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    suffix: data.suffix || null,
                    role: UserRole.PANELIST,
                    isActive: true,
                    mustChangePassword: true,
                    createdById: adminId,
                    updatedById: adminId,
                },
            });

            const isExternal = Boolean(data.isExternal);
            // Hard invariant: external panelists cannot be adviser-available.
            const isAvailableAsAdviser = isExternal
                ? false
                : data.isAvailableAsAdviser !== false;

            const panelist = await tx.panelist.create({
                data: {
                    userId: user.id,
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal,
                    isAvailableAsAdviser,
                },
                include: { user: { select: userSelect } },
            });
            return panelist;
        });
    }

    async updateWithUserTransaction(id: string, data: any, adminId: string, passwordHash?: string) {
        return prisma.$transaction(async (tx) => {
            const panelistRecord = await tx.panelist.findUnique({
                where: { id },
                include: { user: true },
            });

            if (!panelistRecord) throw new Error("Panelist not found!");

            // Patch-safe user fields for status-only PUT { isActive }.
            const userData: Record<string, unknown> = {
                updatedById: adminId,
            };
            if (typeof data.firstName === "string") {
                userData.firstName = data.firstName;
            }
            if (typeof data.lastName === "string") {
                userData.lastName = data.lastName;
            }
            if (data.title !== undefined) {
                userData.title = data.title || null;
            }
            if (data.suffix !== undefined) {
                userData.suffix = data.suffix || null;
            }
            if (typeof data.isActive === "boolean") {
                userData.isActive = data.isActive;
            }
            if (passwordHash) {
                userData.passwordHash = passwordHash;
            }

            await tx.user.update({
                where: { id: panelistRecord.userId },
                data: userData,
            });

            // Patch-safe flags + hard external invariant.
            const { isExternal, isAvailableAsAdviser } =
                resolvePanelistAdviserFlags(data, {
                    isExternal: panelistRecord.isExternal,
                    isAvailableAsAdviser: panelistRecord.isAvailableAsAdviser,
                });

            return tx.panelist.update({
                where: { id },
                data: {
                    highestEducationalAttainment:
                        data.highestEducationalAttainment === undefined
                            ? panelistRecord.highestEducationalAttainment
                            : data.highestEducationalAttainment,
                    officeAffiliation:
                        data.officeAffiliation === undefined
                            ? panelistRecord.officeAffiliation
                            : data.officeAffiliation,
                    specialization:
                        data.specialization === undefined
                            ? panelistRecord.specialization
                            : data.specialization,
                    isExternal,
                    isAvailableAsAdviser,
                },
                include: { user: { select: userSelect } },
            });
        });
    }
}
