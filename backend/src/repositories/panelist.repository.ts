import { FACULTY_CONFIGURATION_ENABLED } from "../access/faculty-configuration";
import { AppError } from "../utils/AppError";
import prisma from "../config/database";

export class PanelistRepository {
    async findUserById(userId: string) {
        return prisma.panelist.findFirst({ where: { userId } });
    }

    async updateAvailability(id: string, isAvailableAsAdviser: boolean) {
        if (FACULTY_CONFIGURATION_ENABLED) throw new AppError("Adviser availability is managed by an Administrator.", 403);
        return prisma.panelist.update({
            where: { id },
            data: { isAvailableAsAdviser }
        });
    }
}
