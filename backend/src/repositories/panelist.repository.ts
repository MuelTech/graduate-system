import prisma from "../config/database";

export class PanelistRepository {
    async findUserById(userId: string) {
        return prisma.panelist.findFirst({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        title: true,
                        firstName: true,
                        lastName: true,
                        suffix: true,
                        email: true,
                        isActive: true,
                        _count: {
                            select: {
                                adviserAssignments: { where: { isActive: true } },
                                panelAssignments: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async updateAvailability(id: string, isAvailableAsAdviser: boolean) {
        return prisma.panelist.update({
            where: { id },
            data: { isAvailableAsAdviser }
        });
    }
}
