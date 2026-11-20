import { AdminPanelistRepository } from '../repositories/admin-panelist.repository';
import bcrypt from "bcryptjs";
import { AppError } from '../utils/AppError';
import {
    evaluateFacultyDeactivationImpact,
    type FacultyDeactivationImpact,
} from './faculty-deactivation.rules';

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

    async getDeactivationImpact(id: string): Promise<FacultyDeactivationImpact> {
        const data = await adminPanelistRepository.findDeactivationImpactData(id);
        if (!data) {
            throw new AppError("Faculty account not found.", 404);
        }
        return evaluateFacultyDeactivationImpact(data);
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

        const isDeactivating =
            data.isActive === false &&
            (panelist.user.isActive || panelist.isActive);

        let handoffSummary:
            | {
                  scheduledDefensesCount: number;
                  activeAdviseesCount: number;
                  pendingAdviserRequestsCount: number;
              }
            | undefined;

        if (isDeactivating) {
            const impact = await this.getDeactivationImpact(id);
            if (!impact.canDeactivate) {
                throw new AppError(
                    impact.blockedReason ??
                        "This faculty member is assigned to an active defense session. Conclude the defense before deactivating this account.",
                    409,
                );
            }
            if (impact.requiresHandoffConfirmation && data.confirmHandoff !== true) {
                throw new AppError(
                    "This faculty member has scheduled defenses, active advisees, or pending adviser requests. Review the impact and confirm deactivation.",
                    409,
                );
            }
            handoffSummary = {
                scheduledDefensesCount: impact.scheduledDefenses.length,
                activeAdviseesCount: impact.activeAdvisees.length,
                pendingAdviserRequestsCount: impact.pendingAdviserRequests.length,
            };
        }

        let passwordHash: string | undefined;
        if (data.password && data.password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(data.password, salt);
        }

        return adminPanelistRepository.updateWithUserTransaction(
            id,
            data,
            adminId,
            passwordHash,
            handoffSummary,
        );
    }
}
