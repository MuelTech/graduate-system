import { PanelistRepository } from '../repositories/panelist.repository';
import { UserRole, User } from '@prisma/client';
import bcrypt from "bcryptjs";
import prisma from "../config/database";

const panelistRepository = new PanelistRepository();

export class PanelistService {
    async getAllPanelists() {
        return panelistRepository.findAll();
    }

    async createPanelist(data: any) {
        // Check if email is already in use
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existingUser) {
            throw new Error("Email is already in use by another account.");
        }

        //Hash default password using their last name
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.lastName.toUpperCase(), salt);

        // Create User and Panelist in a transaction to ensure both succeed or fail together
        return prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: data.email,
                    passwordHash,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    role: UserRole.PANELIST,
                    isActive: true,
                },
            });

            const panelist = await tx.panelist.create({
                data: {
                    userId: user.id,
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal: data.isExternal,
                    isAvailableAsAdviser: true, // Default to available
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            isActive: true,
                        },
                    },
                },
            });

            return panelist;
        });
    }

    async updatePanelist(id: string, data: any) {
        // Separate User updates (firstName, lastName, isActive) from Panelist updates
        return prisma.$transaction(async (tx) => {
            const panelistRecord = await tx.panelist.findUnique({
                where: { id },
                include: { user: true },
            });

            if (!panelistRecord) throw new Error("Panelist not found!");

            //Update user details if provided
            if (
                data.firstName ||
                data.lastName ||
                data.isActive !== undefined
            ) {
                await tx.user.update({
                    where: { id: panelistRecord.userId },
                    data: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        isActive: data.isActive,
                    },
                });
            }

            //Update Panelist details
            return tx.panelist.update({
                where: { id },
                data: {
                    highestEducationalAttainment: data.highestEducationalAttainment,
                    officeAffiliation: data.officeAffiliation,
                    specialization: data.specialization,
                    isExternal: data.isExternal,
                    isAvailableAsAdviser: data.isAvailableAsAdviser,
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            isActive: true,
                        },
                    },
                },
            });
        });
    }

    async toggleAvailability(userId: string, isAvailableAsAdviser: boolean) {
        // First find the panelist record associated with this user
        const panelistRecord = await panelistRepository.findUserById(userId);

        if (!panelistRecord) {
            throw new Error("Panelist profile not found for this user.");
        }

        //Update the availability flag
        return panelistRepository.updateAvailability(panelistRecord.id, isAvailableAsAdviser);
    }
}