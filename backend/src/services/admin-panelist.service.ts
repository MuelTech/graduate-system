import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { OperationalAuthorization } from "../access/operational-authorization";
import { facultyAuthorization, facultyCapabilityKeys, facultyId, parseFacultyCreate, parseFacultyPatch,
    FACULTY_AUDIT_ACTIONS } from "../access/faculty-configuration";
import { ACCESS_AUDIT_ACTIONS, type AccessAuditState } from "../access/access-audit";
import { AdminPanelistRepository, type FacultyProfile } from "../repositories/admin-panelist.repository";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AppError } from "../utils/AppError";

function target(row: FacultyProfile | null, expectedId?: string): FacultyProfile {
    if (!row || (expectedId !== undefined && row.id !== expectedId) || !row.user || row.userId !== row.user.id || !isAcademicAccountRole(row.user.role)) {
        throw new AppError("Faculty account not found.", 404);
    }
    try {
        if (row.user.administratorAccess) throw new Error("Wrong account access category.");
        facultyCapabilityKeys(row.user.capabilityGrants.map(grant => grant.capabilityKey));
        if ([row.isExternal, row.isActive, row.isAvailableAsAdviser, row.user.isActive].some(value => typeof value !== "boolean")) {
            throw new Error("Malformed profile state.");
        }
    } catch { throw new AppError("Faculty configuration requires review.", 409); }
    return row;
}
function summary(row: FacultyProfile) {
    const user = row.user;
    return {
        id: row.id, userId: row.userId, highestEducationalAttainment: row.highestEducationalAttainment,
        officeAffiliation: row.officeAffiliation, specialization: row.specialization,
        isExternal: row.isExternal, isAvailableAsAdviser: !row.isExternal && row.isAvailableAsAdviser,
        isActive: row.isActive, createdAt: row.createdAt,
        capabilityKeys: facultyCapabilityKeys(user.capabilityGrants.map(grant => grant.capabilityKey)),
        user: { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName,
            title: user.title, suffix: user.suffix, isActive: user.isActive, createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            createdBy: user.createdBy ? { firstName: user.createdBy.firstName, lastName: user.createdBy.lastName } : null,
            updatedBy: user.updatedBy ? { firstName: user.updatedBy.firstName, lastName: user.updatedBy.lastName } : null },
    };
}
function accessState(row: FacultyProfile): AccessAuditState {
    return { administratorLevel: null, capabilities: facultyCapabilityKeys(row.user.capabilityGrants.map(grant => grant.capabilityKey)),
        isActive: row.user.isActive && row.isActive };
}

export class AdminPanelistService {
    constructor(private readonly authorization: OperationalAuthorization = facultyAuthorization,
        private readonly repository = new AdminPanelistRepository()) {}

    private async authorize(actorId: string, key: "faculty.view" | "faculty.manage") {
        if (!this.authorization.enabled) throw new AppError("Faculty configuration is not activated.", 503);
        await this.authorization.assert(actorId, key);
    }
    async getAllPanelists(actorId = "") {
        await this.authorize(actorId, "faculty.view");
        return (await this.repository.findAll()).map(row => summary(target(row)));
    }
    async getManagementContext(actorId = "") {
        await this.authorize(actorId, "faculty.view");
        const capabilities = await this.authorization.capabilities(actorId);
        return { canManage: capabilities.includes("faculty.manage") };
    }
    async getPanelistById(id: string, actorId = "") {
        await this.authorize(actorId, "faculty.view");
        return summary(target(await this.repository.findById(facultyId(id)), id));
    }

    private async audit(tx: Prisma.TransactionClient, actorId: string, action: string, before: FacultyProfile | null,
        after: FacultyProfile, capabilityKey?: string) {
        const occurredAt = new Date();
        const previous = capabilityKey ? (before ? accessState(before) : null) : (before ? summary(before) : null);
        const next = capabilityKey ? accessState(after) : summary(after);
        await tx.auditLog.create({ data: { actorId, actionType: action, targetTable: "users", targetId: after.userId,
            oldValue: previous ? JSON.stringify(previous) : null, newValue: JSON.stringify(next), createdAt: occurredAt,
            description: JSON.stringify({ version: 1, action, actorUserId: actorId, targetUserId: after.userId,
                occurredAt: occurredAt.toISOString(), before: previous, after: next, ...(capabilityKey ? { capabilityKey } : {}) }) } });
    }
    private identityConflict(error: unknown): never {
        if ((error as { code?: string })?.code === "P2002") throw new AppError("Account identity already exists.", 409);
        throw error;
    }
    async createPanelist(input: unknown, actorId: string) {
        await this.authorize(actorId, "faculty.manage");
        const data = parseFacultyCreate(input);
        const isExternal = data.isExternal ?? false;
        if (isExternal && data.isAvailableAsAdviser === true) throw new AppError("External Faculty cannot be available as Adviser.", 400);
        const temporaryPassword = randomBytes(32).toString("base64url");
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        try {
            return await this.authorization.write(actorId, "faculty.manage", async tx => {
                if (!tx) throw new AppError("Faculty configuration is not activated.", 503);
                const created = await tx.user.create({ data: {
                    email: data.email, firstName: data.firstName, lastName: data.lastName, title: data.title ?? null,
                    suffix: data.suffix ?? null, role: "FACULTY", passwordHash, mustChangePassword: true,
                    isActive: data.isActive ?? true, createdById: actorId, updatedById: actorId,
                }, select: { id: true } });
                const profile = await tx.panelist.create({ data: {
                    userId: created.id, highestEducationalAttainment: data.highestEducationalAttainment ?? null,
                    officeAffiliation: data.officeAffiliation ?? null, specialization: data.specialization ?? null,
                    isExternal, isAvailableAsAdviser: !isExternal && (data.isAvailableAsAdviser ?? false), isActive: data.isActive ?? true,
                }, select: { id: true } });
                const keys = data.capabilityKeys ?? [];
                if (keys.length) await tx.accountCapabilityGrant.createMany({ data: keys.map(capabilityKey => ({
                    userId: created.id, capabilityKey, createdById: actorId, updatedById: actorId,
                })) });
                const after = target(await new AdminPanelistRepository(tx).findById(profile.id));
                await this.audit(tx, actorId, FACULTY_AUDIT_ACTIONS.CREATED, null, after);
                for (const key of keys) await this.audit(tx, actorId, ACCESS_AUDIT_ACTIONS.CAPABILITY_GRANTED, null, after, key);
                // One-time response, returned only after commit; never in summaries, audit, email or storage.
                return { account: summary(after), temporaryPassword };
            });
        } catch (error) { return this.identityConflict(error); }
    }
    async updatePanelist(id: string, input: unknown, actorId: string) {
        await this.authorize(actorId, "faculty.manage");
        const profileId = facultyId(id); const patch = parseFacultyPatch(input);
        try {
            return await this.authorization.write(actorId, "faculty.manage", async tx => {
                if (!tx) throw new AppError("Faculty configuration is not activated.", 503);
                const link = await tx.panelist.findUnique({ where: { id: profileId }, select: { userId: true } });
                if (!link) throw new AppError("Faculty account not found.", 404);
                await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${link.userId} FOR UPDATE`;
                await tx.$queryRaw`SELECT panelist_id FROM panelists WHERE panelist_id = ${profileId} FOR UPDATE`;
                const repo = new AdminPanelistRepository(tx); const before = target(await repo.findById(profileId), profileId);
                if (before.userId !== link.userId) throw new AppError("Faculty account changed. Reload before saving.", 409);
                const isExternal = patch.isExternal ?? before.isExternal;
                if (isExternal && patch.isAvailableAsAdviser === true) throw new AppError("External Faculty cannot be available as Adviser.", 400);
                // DR-7: neither repair an existing anomaly nor make an active Adviser External.
                if ((before.isExternal || isExternal) && await tx.adviserAssignment.findFirst({ where: { adviserId: before.userId, isActive: true }, select: { id: true } })) {
                    throw new AppError("This Adviser classification requires institutional review.", 409);
                }
                const userData: Prisma.UserUncheckedUpdateManyInput = { updatedById: actorId };
                for (const key of ["email", "firstName", "lastName", "title", "suffix", "isActive"] as const) {
                    if (patch[key] !== undefined) Object.assign(userData, { [key]: patch[key] });
                }
                const updated = await tx.user.updateMany({ where: { id: before.userId, role: { in: ["FACULTY", "PANELIST"] } }, data: userData });
                if (updated.count !== 1) throw new AppError("Faculty account changed. Reload before saving.", 409);
                const profileData: Prisma.PanelistUpdateInput = {
                    isExternal, isAvailableAsAdviser: !isExternal && (patch.isAvailableAsAdviser ?? before.isAvailableAsAdviser),
                };
                for (const key of ["highestEducationalAttainment", "officeAffiliation", "specialization", "isActive"] as const) {
                    if (patch[key] !== undefined) Object.assign(profileData, { [key]: patch[key] });
                }
                await tx.panelist.update({ where: { id: profileId }, data: profileData, select: { id: true } });
                const oldKeys = accessState(before).capabilities; const keys = patch.capabilityKeys ?? oldKeys;
                const revoked = oldKeys.filter(key => !keys.includes(key)); const granted = keys.filter(key => !oldKeys.includes(key));
                if (revoked.length) await tx.accountCapabilityGrant.deleteMany({ where: { userId: before.userId, capabilityKey: { in: [...revoked] } } });
                if (granted.length) await tx.accountCapabilityGrant.createMany({ data: granted.map(capabilityKey => ({
                    userId: before.userId, capabilityKey, createdById: actorId, updatedById: actorId,
                })) });
                const after = target(await repo.findById(profileId), profileId);
                await this.audit(tx, actorId, FACULTY_AUDIT_ACTIONS.CONFIGURED, before, after);
                for (const key of revoked) await this.audit(tx, actorId, ACCESS_AUDIT_ACTIONS.CAPABILITY_REVOKED, before, after, key);
                for (const key of granted) await this.audit(tx, actorId, ACCESS_AUDIT_ACTIONS.CAPABILITY_GRANTED, before, after, key);
                return summary(after);
            });
        } catch (error) { return this.identityConflict(error); }
    }
}
