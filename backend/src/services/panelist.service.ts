import { PanelistRepository } from '../repositories/panelist.repository';
import bcrypt from "bcryptjs";

const panelistRepository = new PanelistRepository();

export class PanelistService {
    async getAllPanelists() {
        return panelistRepository.findAll();
    }

    async createPanelist(data: any) {
        // Check if email is already in use via Repository
        const existingUser = await panelistRepository.checkEmailInUse(data.email);
        if (existingUser) {
            throw new Error("Email is already in use by another account.");
        }

        // Hash default password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.lastName.toUpperCase(), salt);

        // Delegate transaction logic to Repository
        return panelistRepository.createWithUserTransaction(data, passwordHash);
    }

    async updatePanelist(id: string, data: any) {
        // Delegate transaction logic to Repository
        return panelistRepository.updateWithUserTransaction(id, data);
    }

    async toggleAvailability(userId: string, isAvailableAsAdviser: boolean) {
        const panelistRecord = await panelistRepository.findUserById(userId);

        if (!panelistRecord) {
            throw new Error("Panelist profile not found for this user.");
        }

        return panelistRepository.updateAvailability(panelistRecord.id, isAvailableAsAdviser);
    }

    async getPanelistByUserId(userId: string) {
        return panelistRepository.findUserById(userId);
    }
}
