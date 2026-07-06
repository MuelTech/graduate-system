import { Prisma } from "@prisma/client";
import prisma from "../config/database";

export class PanelistRepository{
    async findAll() {
        return prisma.panelist.findMany({
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async create(data: {
        userId: string;
        highestEducationalAttainment?: string;
        officeAffiliation?: string;
        specialization?: string;
        isExternal: boolean;
    }) {
        return prisma.panelist.create({
            data,
            include: { user: true },
        });
    }

    async update(id: string, data: Prisma.PanelistUpdateInput) {
        return prisma.panelist.update({
            where: { id },
            data,
            include: { user: true },
        });
    }

    async findById(id: string) {
        return prisma.panelist.findUnique({
            where: { id },
            include: { user: true },
        });
    }

    async findUserById(userId: string) {
        return prisma.panelist.findFirst({
            where: { userId }
        });
    }

    async updateAvailability(id: string, isAvailableAsAdviser: boolean) {
        return prisma.panelist.update({
            where: { id },
            data: { isAvailableAsAdviser }
        });
    }
}