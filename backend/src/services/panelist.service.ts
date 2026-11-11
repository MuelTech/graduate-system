import { PanelistRepository } from '../repositories/panelist.repository';
import { AppError } from '../utils/AppError';

const panelistRepository = new PanelistRepository();

export class PanelistService {
    async toggleAvailability(_userId: string, _isAvailableAsAdviser: boolean) {
        throw new AppError("Adviser availability is managed by the Graduate School Administrator.", 403);
    }

    async getPanelistByUserId(userId: string) {
        return panelistRepository.findUserById(userId);
    }
}
