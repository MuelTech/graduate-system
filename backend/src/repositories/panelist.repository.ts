import { FACULTY_CONFIGURATION_ENABLED } from "../access/faculty-configuration";
import { EXTERNAL_ACTIVE_ADVISER_MESSAGE } from "../services/active-adviser.rules";
import { AppError } from "../utils/AppError";
import prisma from "../config/database";

export class PanelistRepository {
    async findUserById(userId: string) {
        return prisma.panelist.findFirst({ where: { userId } });
    }

    /**
     * Authoritative Internal vs External classification from `Panelist.isExternal`.
     * Propagates database errors cleanly rather than masking failures.
     */
    async isExternalFaculty(userId: string): Promise<boolean> {
        const panelist = await prisma.panelist.findUnique({
            where: { userId },
            select: { isExternal: true },
        });
        return panelist?.isExternal === true;
    }

    /**
     * Fail-closed active Internal Faculty validation for Adviser-only official records.
     * Denies missing, inactive, or External Panelist profiles with 403 and propagates DB errors.
     */
    async assertActiveInternalFaculty(userId: string): Promise<void> {
        const panelist = await prisma.panelist.findUnique({
            where: { userId },
            select: { isActive: true, isExternal: true },
        });
        if (!panelist || panelist.isActive !== true || panelist.isExternal !== false) {
            throw new AppError(EXTERNAL_ACTIVE_ADVISER_MESSAGE, 403);
        }
    }

    async updateAvailability(id: string, isAvailableAsAdviser: boolean) {
        if (FACULTY_CONFIGURATION_ENABLED) throw new AppError("Adviser availability is managed by an Administrator.", 403);
        return prisma.panelist.update({
            where: { id },
            data: { isAvailableAsAdviser }
        });
    }
}
