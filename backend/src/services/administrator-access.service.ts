import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { AdministratorAccessRepository, type AdministratorAccount } from "../repositories/administrator-access.repository";
import { ADMINISTRATOR_MANAGEMENT_ENABLED, administratorId, assertFullAdministrator,
  parseAdministratorCreate, parseAdministratorPage, parseAdministratorPatch, validateAdministratorConfiguration } from "../access/administrator-management";
import { resolveConfiguredAccountAccess } from "../access/account-access";
import { ACCESS_AUDIT_ACTIONS, type AccessAuditEvent, type AccessAuditState } from "../access/access-audit";
import type { CapabilityKey } from "../access/capability-catalog";

function state(account: AdministratorAccount): AccessAuditState {
  return { administratorLevel: account.administratorAccess?.level as AccessAuditState["administratorLevel"],
    capabilities: account.capabilityGrants.map(grant => grant.capabilityKey as CapabilityKey).sort(), isActive: account.isActive };
}
function summary(account: AdministratorAccount) {
  const access = resolveConfiguredAccountAccess(account);
  return { id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName,
    role: account.role, isActive: account.isActive, mustChangePassword: account.mustChangePassword,
    level: account.administratorAccess?.level ?? null,
    capabilityKeys: account.capabilityGrants.map(grant => grant.capabilityKey).sort(),
    configuredAccess: { status: access.status, capabilities: access.capabilities } };
}

export class AdministratorAccessService {
  /** The injectable gate is an internal composition/test seam, never request/environment configuration. */
  constructor(private readonly repository = new AdministratorAccessRepository(),
    private readonly enabled: () => boolean = () => ADMINISTRATOR_MANAGEMENT_ENABLED) {}

  private async authorized<T>(actorId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    if (!this.enabled()) throw new AppError("Administrator management is not activated.", 503);
    const id = administratorId(actorId);
    return this.repository.withLock(async tx => {
      const actor = await this.repository.findAccount(tx, id);
      if (actor?.id !== id) throw new AppError("Full Administrator authority is required.", 403);
      assertFullAdministrator(actor); // AFTER the fence, never a cached route/JWT result.
      return operation(tx);
    });
  }
  private async target(tx: Prisma.TransactionClient, id: string) {
    const target = await this.repository.findAccount(tx, id);
    if (!target || target.id !== id || target.role !== "ADMIN") throw new AppError("Administrator account not found.", 404);
    return target;
  }
  private requireManaged(target: AdministratorAccount) {
    if (!target.administratorAccess) throw new AppError("Unmapped Administrator access requires reviewed operator reconciliation.", 409);
    try {
      return validateAdministratorConfiguration({ level: target.administratorAccess.level as "FULL" | "RESTRICTED",
        capabilityKeys: target.capabilityGrants.map(grant => grant.capabilityKey as CapabilityKey) });
    } catch { throw new AppError("Invalid Administrator access requires reviewed operator reconciliation.", 409); }
  }
  private async preserveFull(tx: Prisma.TransactionClient, targetId: string, after: AccessAuditState) {
    const population = await this.repository.activeFullAccounts(tx);
    const otherFull = population.some(account => account.id !== targetId &&
      resolveConfiguredAccountAccess(account).status === "RESOLVED" &&
      resolveConfiguredAccountAccess(account).administratorLevel === "FULL");
    if (!otherFull && !(after.isActive && after.administratorLevel === "FULL")) {
      throw new AppError("At least one active Full Administrator must remain.", 409);
    }
  }
  private async audit(tx: Prisma.TransactionClient, action: AccessAuditEvent["action"], actorId: string,
    targetId: string, before: AccessAuditState | null, after: AccessAuditState, capabilityKey?: CapabilityKey) {
    const occurredAt = new Date();
    const event: AccessAuditEvent & { capabilityKey?: CapabilityKey } = {
      version: 1, action, actorUserId: actorId, targetUserId: targetId, occurredAt: occurredAt.toISOString(), before, after,
      ...(capabilityKey ? { capabilityKey } : {}),
    };
    await tx.auditLog.create({ data: { actorId, actionType: action, targetTable: "administrator_access", targetId,
      oldValue: before ? JSON.stringify(before) : null, newValue: JSON.stringify(after),
      description: JSON.stringify(event), createdAt: occurredAt } });
  }

  async list(actorId: string, query: unknown) {
    const { page, pageSize } = parseAdministratorPage(query);
    return this.authorized(actorId, async tx => ({ page, pageSize,
      accounts: (await this.repository.listAccounts(tx, page, pageSize)).map(summary) }));
  }
  async get(actorId: string, targetId: unknown) {
    const id = administratorId(targetId);
    return this.authorized(actorId, async tx => summary(await this.target(tx, id)));
  }
  async create(actorId: string, input: unknown) {
    if (!this.enabled()) throw new AppError("Administrator management is not activated.", 503);
    const data = parseAdministratorCreate(input);
    const temporaryPassword = randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    try {
      return await this.authorized(actorId, async tx => {
        const created = await tx.user.create({ data: { email: data.email, firstName: data.firstName, lastName: data.lastName,
          role: "ADMIN", passwordHash, isActive: true, mustChangePassword: true, createdById: actorId, updatedById: actorId },
          select: { id: true } });
        await tx.administratorAccess.create({ data: { userId: created.id, level: data.level, createdById: actorId, updatedById: actorId } });
        if (data.capabilityKeys.length) await tx.accountCapabilityGrant.createMany({ data: data.capabilityKeys.map(capabilityKey => ({
          userId: created.id, capabilityKey, createdById: actorId, updatedById: actorId,
        })) });
        const after: AccessAuditState = { administratorLevel: data.level, capabilities: data.capabilityKeys, isActive: true };
        await this.audit(tx, ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_CREATED, actorId, created.id, null, after);
        const account = await this.target(tx, created.id);
        // Returned only after successful commit; never included in summaries, logs, audit, email, or error output.
        return { account: summary(account), temporaryPassword };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new AppError("Administrator identity already exists.", 409);
      throw error;
    }
  }
  async update(actorId: string, targetId: unknown, input: unknown) {
    const id = administratorId(targetId); const patch = parseAdministratorPatch(input);
    return this.authorized(actorId, async tx => {
      const target = await this.target(tx, id); const current = this.requireManaged(target);
      const configuration = validateAdministratorConfiguration({ level: patch.level ?? current.level,
        capabilityKeys: patch.capabilityKeys ?? current.capabilityKeys });
      const before = state(target);
      const after: AccessAuditState = { administratorLevel: configuration.level,
        capabilities: configuration.capabilityKeys, isActive: patch.isActive ?? target.isActive };
      await this.preserveFull(tx, id, after);
      const granted = after.capabilities.filter(key => !before.capabilities.includes(key));
      const revoked = before.capabilities.filter(key => !after.capabilities.includes(key));
      const levelChanged = before.administratorLevel !== after.administratorLevel;
      const statusChanged = before.isActive !== after.isActive;
      if (levelChanged) await tx.administratorAccess.update({ where: { userId: id }, data: { level: configuration.level, updatedById: actorId } });
      if (statusChanged) await tx.user.update({ where: { id }, data: { isActive: after.isActive, updatedById: actorId } });
      if (revoked.length) await tx.accountCapabilityGrant.deleteMany({ where: { userId: id, capabilityKey: { in: [...revoked] } } });
      if (granted.length) await tx.accountCapabilityGrant.createMany({ data: granted.map(capabilityKey => ({
        userId: id, capabilityKey, createdById: actorId, updatedById: actorId,
      })) });
      if (levelChanged) await this.audit(tx, ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_LEVEL_CHANGED, actorId, id, before, after);
      if (statusChanged) await this.audit(tx, ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_STATUS_CHANGED, actorId, id, before, after);
      for (const key of revoked) await this.audit(tx, ACCESS_AUDIT_ACTIONS.CAPABILITY_REVOKED, actorId, id, before, after, key);
      for (const key of granted) await this.audit(tx, ACCESS_AUDIT_ACTIONS.CAPABILITY_GRANTED, actorId, id, before, after, key);
      return summary(await this.target(tx, id));
    });
  }
  /** Remove target authority without deleting its User/history/attribution. Disable blocks legacy role-only paths too. */
  async removeAccess(actorId: string, targetId: unknown) {
    const id = administratorId(targetId);
    return this.authorized(actorId, async tx => {
      const target = await this.target(tx, id); this.requireManaged(target);
      const before = state(target);
      const after: AccessAuditState = { administratorLevel: null, capabilities: [], isActive: false };
      await this.preserveFull(tx, id, after);
      await tx.user.update({ where: { id }, data: { isActive: false, updatedById: actorId } });
      await tx.accountCapabilityGrant.deleteMany({ where: { userId: id } });
      await tx.administratorAccess.delete({ where: { userId: id } });
      await this.audit(tx, ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_REMOVED, actorId, id, before, after);
      return summary(await this.target(tx, id));
    });
  }
}
