import { PanelistRepository } from '../repositories/panelist.repository';
import bcrypt from "bcryptjs";

const panelistRepository = new PanelistRepository();

export class PanelistService {
    async getAllPanelists() {
        return panelistRepository.findAll();
    }

    async getPanelistById(id: string) {
        return panelistRepository.findById(id);
    }

    async createPanelist(data: any) {
        // Check if email is already in use
        const existingUser = await panelistRepository.checkEmailInUse(data.email);
        if (existingUser) {
            throw new Error("Email is already in use by another account.");
        }

        // Hash default password (LASTNAME uppercase)
        const salt = await bcrypt.genSalt(10);
        const defaultPassword = data.lastName.toUpperCase();
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const panelist = await panelistRepository.createWithUserTransaction(data, passwordHash);

        // Return panelist with default password for display
        return { ...panelist, defaultPassword };
    }

    async updatePanelist(id: string, data: any) {
        // Handle password reset if provided
        let passwordHash: string | undefined;
        if (data.password && data.password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(data.password, salt);
        }

        return panelistRepository.updateWithUserTransaction(id, data, passwordHash);
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
