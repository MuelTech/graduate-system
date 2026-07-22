import prisma from "../config/database";

export class PanelistRepository {
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
