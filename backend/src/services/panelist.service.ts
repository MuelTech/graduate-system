import { facultyAuthorization } from "../access/faculty-configuration";
import { OperationalAuthorization } from "../access/operational-authorization";
import { PanelistRepository } from '../repositories/panelist.repository';
import { AppError } from '../utils/AppError';
import { isAcademicAccountRole } from '../utils/academic-account';

const panelistRepository = new PanelistRepository();

export class PanelistService {
    constructor(private readonly authorization: OperationalAuthorization = facultyAuthorization) {}
    async toggleAvailability(userId: string, isAvailableAsAdviser: boolean) {
        if (this.authorization.enabled) throw new AppError("Adviser availability is managed by an Administrator.", 403);
        const panelistRecord = await panelistRepository.findUserById(userId);

        if (!panelistRecord) {
            throw new AppError("Panelist profile not found for this user.", 404);
        }

        return panelistRepository.updateAvailability(panelistRecord.id, isAvailableAsAdviser);
    }

    async getPanelistByUserId(userId: string) {
        if (!this.authorization.enabled) return panelistRepository.findUserById(userId);
        const actor = await this.authorization.current({ userId, role: "PANELIST" });
        if (!isAcademicAccountRole(actor.role)) throw new AppError("Access denied.", 403);
        const profile = await panelistRepository.findUserById(actor.userId);
        if (!profile || profile.userId !== actor.userId) throw new AppError("Faculty profile not found.", 404);
        return { ...profile, isAvailableAsAdviser: !profile.isExternal && profile.isAvailableAsAdviser };
    }
}
