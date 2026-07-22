import { PanelistRepository } from '../repositories/panelist.repository';
import { AppError } from '../utils/AppError';

const panelistRepository = new PanelistRepository();

export class PanelistService {
    async toggleAvailability(userId: string, isAvailableAsAdviser: boolean) {
        const panelistRecord = await panelistRepository.findUserById(userId);

        if (!panelistRecord) {
            throw new AppError("Panelist profile not found for this user.", 404);
        }

        return panelistRepository.updateAvailability(panelistRecord.id, isAvailableAsAdviser);
    }

    async getPanelistByUserId(userId: string) {
        return panelistRepository.findUserById(userId);
    }
}
