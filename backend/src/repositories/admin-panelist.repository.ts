import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { UserRole } from "@prisma/client";
import { disconnectUserDefenseSockets } from "../realtime/defense-realtime.registry";

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
    _count: {
        select: {
            adviserAssignments: {
                where: { isActive: true },
            },
            panelAssignments: true,
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

    async findDeactivationImpactData(panelistId: string) {
        const panelist = await prisma.panelist.findUnique({
            where: { id: panelistId },
            select: {
                id: true,
                userId: true,
            },
        });
        if (!panelist) return null;

        const [panelAssignments, adviserAssignments, pendingAdviserRequests] =
            await Promise.all([
                prisma.panelAssignment.findMany({
                    where: {
                        userId: panelist.userId,
                        isActive: true,
                        schedule: {
                            sessionStatus: {
                                in: ["IN_PROGRESS", "AWAITING_CONCLUSION", "SCHEDULED"],
                            },
                        },
                    },
                    select: {
                        role: true,
                        schedule: {
                            select: {
                                id: true,
                                defenseType: true,
                                sessionStatus: true,
                                defenseDate: true,
                                thesis: {
                                    select: {
                                        student: {
                                            select: {
                                                user: {
                                                    select: {
                                                        firstName: true,
                                                        lastName: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { schedule: { defenseDate: "asc" } },
                }),
                prisma.adviserAssignment.findMany({
                    where: {
                        adviserId: panelist.userId,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        studentId: true,
                        student: {
                            select: {
                                studentNumber: true,
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { assignedDate: "desc" },
                }),
                prisma.adviserRequest.findMany({
                    where: {
                        requestedAdviserId: panelist.userId,
                        status: "PENDING",
                        adviserStatus: "PENDING",
                    },
                    select: {
                        id: true,
                        requestDate: true,
                        student: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { requestDate: "desc" },
                }),
            ]);

        return {
            panelistId: panelist.id,
            userId: panelist.userId,
            panelAssignments,
            adviserAssignments,
            pendingAdviserRequests,
        };
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
                    role: UserRole.FACULTY,
                    isActive: true,
                    mustChangePassword: true,
                    createdById: adminId,
                    updatedById: adminId,
                },
            });

            const isExternal = Boolean(data.isExternal);
            // Hard invariant: external faculty cannot be adviser-available.
            const isAvailableAsAdviser = isExternal
                ? false
                : data.isAvailableAsAdviser !== false;
            const canEvaluateEssays = Boolean(data.canEvaluateEssays);

            const panelist = await tx.panelist.create({
                data: {
                    userId: user.id,
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal,
                    isAvailableAsAdviser,
                    canEvaluateEssays,
                },
                include: { user: { select: userSelect } },
            });
            return panelist;
        });
    }

    async updateWithUserTransaction(
        id: string,
        data: any,
        adminId: string,
        passwordHash?: string,
        deactivationHandoffSummary?: {
            scheduledDefensesCount: number;
            activeAdviseesCount: number;
            pendingAdviserRequestsCount: number;
        },
    ) {
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
            if (typeof data.email === "string" && data.email.trim()) {
                userData.email = data.email.trim();
            }
            const previousIsActive =
                panelistRecord.user.isActive && panelistRecord.isActive;
            const nextIsActive =
                typeof data.isActive === "boolean"
                    ? data.isActive
                    : previousIsActive;
            const shouldInvalidateSessions =
                (typeof data.isActive === "boolean" && !data.isActive) ||
                Boolean(passwordHash);

            if (typeof data.isActive === "boolean") {
                userData.isActive = data.isActive;
            }
            if (passwordHash) {
                userData.passwordHash = passwordHash;
            }
            if (shouldInvalidateSessions) {
                userData.tokenVersion = { increment: 1 };
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
            const canEvaluateEssays =
                typeof data.canEvaluateEssays === "boolean"
                    ? data.canEvaluateEssays
                    : panelistRecord.canEvaluateEssays;

            const updatedPanelist = await tx.panelist.update({
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
                    canEvaluateEssays,
                    ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {}),
                },
                include: { user: { select: userSelect } },
            });

            if (typeof data.isActive === "boolean" && previousIsActive !== nextIsActive) {
                await tx.auditLog.create({
                    data: {
                        actorId: adminId,
                        actionType: nextIsActive
                            ? "USER_ACCOUNT_REACTIVATED"
                            : "USER_ACCOUNT_DEACTIVATED",
                        targetTable: "users",
                        targetId: panelistRecord.userId,
                        oldValue: JSON.stringify({
                            isActive: previousIsActive,
                            panelistId: id,
                        }),
                        newValue: JSON.stringify({
                            isActive: nextIsActive,
                            panelistId: id,
                            ...(deactivationHandoffSummary && !nextIsActive
                                ? { handoffImpact: deactivationHandoffSummary }
                                : {}),
                        }),
                        description: nextIsActive
                            ? `Reactivated Faculty account ${updatedPanelist.user.email}.`
                            : `Deactivated Faculty account ${updatedPanelist.user.email}.`,
                    },
                });
            }

            return {
                updatedPanelist,
                userId: panelistRecord.userId,
                shouldInvalidateSessions,
                deactivated: typeof data.isActive === "boolean" && !data.isActive,
            };
        }).then((payload) => {
            if (payload.shouldInvalidateSessions) {
                void disconnectUserDefenseSockets(
                    payload.userId,
                    payload.deactivated ? "ACCOUNT_DEACTIVATED" : "SESSION_INVALIDATED",
                );
            }
            return payload.updatedPanelist;
        });
    }
}
