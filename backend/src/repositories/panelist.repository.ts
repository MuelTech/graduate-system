import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { UserRole } from "@prisma/client";

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

export class PanelistRepository {
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

            const panelist = await tx.panelist.create({
                data: {
                    userId: user.id,
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal: data.isExternal,
                    isAvailableAsAdviser: true,
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

            const userData: any = {
                firstName: data.firstName,
                lastName: data.lastName,
                title: data.title || null,
                suffix: data.suffix || null,
                isActive: data.isActive,
                updatedById: adminId,
            };
            if (passwordHash) {
                userData.passwordHash = passwordHash;
            }

            await tx.user.update({
                where: { id: panelistRecord.userId },
                data: userData,
            });

            return tx.panelist.update({
                where: { id },
                data: {
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal: data.isExternal,
                    isAvailableAsAdviser: data.isAvailableAsAdviser,
                },
                include: { user: { select: userSelect } },
            });
        });
    }

    async findUserById(userId: string) {
        return prisma.panelist.findFirst({ where: { userId } });
    }

    async updateAvailability(id: string, isAvailableAsAdviser: boolean) {
        return prisma.panelist.update({
            where: { id },
            data: { isAvailableAsAdviser }
        });
    }
}
