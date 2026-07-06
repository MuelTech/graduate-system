import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { UserRole } from "@prisma/client";

export class PanelistRepository {
    async findAll() {
        return prisma.panelist.findMany({
            include: {
                user: {
                    select: { firstName: true, lastName: true, email: true, isActive: true },
                },
            },
            orderBy: { createdAt: "desc" },
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
                    firstName: data.firstName,
                    lastName: data.lastName,
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
                    isAvailableAsAdviser: true, // Default to available
                },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
                },
            });
            return panelist;
        });
    }

    async updateWithUserTransaction(id: string, data: any) {
        return prisma.$transaction(async (tx) => {
            const panelistRecord = await tx.panelist.findUnique({
                where: { id },
                include: { user: true },
            });

            if (!panelistRecord) throw new Error("Panelist not found!");

            if (data.firstName || data.lastName || data.isActive !== undefined) {
                await tx.user.update({
                    where: { id: panelistRecord.userId },
                    data: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        isActive: data.isActive,
                    },
                });
            }

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
                    user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
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
