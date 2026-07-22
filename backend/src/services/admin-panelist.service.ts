import { AdminPanelistRepository } from '../repositories/admin-panelist.repository';
import bcrypt from "bcryptjs";
import { AppError } from '../utils/AppError';

const adminPanelistRepository = new AdminPanelistRepository();

export class AdminPanelistService {
    async getAllPanelists() {
        return adminPanelistRepository.findAll();
    }

    async getPanelistById(id: string) {
        const panelist = await adminPanelistRepository.findById(id);
        if (!panelist) {
            throw new AppError("Panelist not found!", 404);
        }
        return panelist;
    }

    async createPanelist(data: any, adminId: string) {
        const existingUser = await adminPanelistRepository.checkEmailInUse(data.email);
        if (existingUser) {
            throw new AppError("Email is already in use by another account.", 400);
        }

        const salt = await bcrypt.genSalt(10);
        const defaultPassword = data.lastName.toUpperCase();
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const panelist = await adminPanelistRepository.createWithUserTransaction(data, passwordHash, adminId);

        return { ...panelist, defaultPassword };
    }

    async updatePanelist(id: string, data: any, adminId: string) {
        const panelist = await adminPanelistRepository.findById(id);
        if (!panelist) {
            throw new AppError("Panelist not found!", 404);
        }

        let passwordHash: string | undefined;
        if (data.password && data.password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(data.password, salt);
        }

        return adminPanelistRepository.updateWithUserTransaction(id, data, adminId, passwordHash);
    }
}
