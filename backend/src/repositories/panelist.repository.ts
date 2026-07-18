import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { UserRole } from "@prisma/client";

export class PanelistRepository {
    async findAll() {
        return prisma.panelist.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        title: true,
                        suffix: true,
                        isActive: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findById(id: string) {
        return prisma.panelist.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        title: true,
                        suffix: true,
                        isActive: true,
                        createdAt: true,
                    },
                },
            },
        });
    }

    async checkEmailInUse(email: string) {
        return prisma.user.findUnique({ where: { email } });
    }

    async createWithUserTransaction(data: any, passwordHash: string) {
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
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            title: true,
                            suffix: true,
                            isActive: true,
                            createdAt: true,
                        },
                    },
                },
            });
            return panelist;
        });
    }

    async updateWithUserTransaction(id: string, data: any, passwordHash?: string) {
        return prisma.$transaction(async (tx) => {
            const panelistRecord = await tx.panelist.findUnique({
                where: { id },
                include: { user: true },
            });

            if (!panelistRecord) throw new Error("Panelist not found!");

            // Update User fields
            const userData: any = {
                firstName: data.firstName,
                lastName: data.lastName,
                title: data.title || null,
                suffix: data.suffix || null,
                isActive: data.isActive,
            };
            if (passwordHash) {
                userData.passwordHash = passwordHash;
            }

            await tx.user.update({
                where: { id: panelistRecord.userId },
                data: userData,
            });

            // Update Panelist fields
            return tx.panelist.update({
                where: { id },
                data: {
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal: data.isExternal,
                    isAvailableAsAdviser: data.isAvailableAsAdviser,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            title: true,
                            suffix: true,
                            isActive: true,
                            createdAt: true,
                        },
                    },
                },
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
