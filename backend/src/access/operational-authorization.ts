import type { Prisma } from "@prisma/client";
import { resolveConfiguredAccountAccess, hasConfiguredCapability } from "./account-access";
import { FULL_ADMINISTRATOR_CAPABILITIES, type CapabilityKey } from "./capability-catalog";
import type { CurrentAccount } from "../services/current-account";
import { ACCOUNT_ACCESS_SELECT } from "./account-access.store";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AppError } from "../utils/AppError";

/** FACULTY-9 composition only; runtime input cannot activate this package. */
export const OPERATIONAL_ENFORCEMENT_ENABLED: boolean = false;
export interface OperationalActor { userId: string; role: string }
const loadActor = async (id: string) => (await import("../services/current-account")).loadCurrentAccount(id);
const CURRENT_ACTOR_SELECT = { ...ACCOUNT_ACCESS_SELECT, email: true, mustChangePassword: true } as const;

/** Adapter to the accepted resolver, never an alternate grant resolver. */
export class OperationalAuthorization {
  constructor(readonly enabled = OPERATIONAL_ENFORCEMENT_ENABLED, private readonly load = loadActor) {}

  private validate(account: CurrentAccount | null, id: string): CurrentAccount {
    if (!account || account.id !== id || account.isActive !== true || account.mustChangePassword !== false ||
        !["APPLICANT", "STUDENT", "FACULTY", "PANELIST", "ADMIN", "CUSTOM"].includes(account.role) ||
        (isAcademicAccountRole(account.role) && account.panelist?.isActive !== true) ||
        (account.role === "ADMIN" && resolveConfiguredAccountAccess(account).status !== "RESOLVED")) {
      throw new AppError("Current account access denied.", 403);
    }
    return account;
  }

  private async account(id: string): Promise<CurrentAccount> {
    if (typeof id !== "string" || !id.trim()) throw new AppError("Access denied.", 403);
    return this.validate(await this.load(id), id);
  }

  async current(actor: OperationalActor): Promise<OperationalActor> {
    if (!this.enabled) return actor;
    const account = await this.account(actor?.userId);
    return { userId: account.id, role: account.role };
  }

  async capabilities(id: string): Promise<readonly CapabilityKey[]> {
    if (!this.enabled) return FULL_ADMINISTRATOR_CAPABILITIES;
    const access = resolveConfiguredAccountAccess(await this.account(id));
    if (access.category !== "ADMIN") throw new AppError("Access denied.", 403);
    return access.capabilities;
  }

  async assert(id: string, key: CapabilityKey): Promise<void> {
    if (!this.enabled) return;
    const access = resolveConfiguredAccountAccess(await this.account(id));
    if (access.category !== "ADMIN" || !hasConfiguredCapability(access, key)) {
      throw new AppError("Access denied.", 403);
    }
  }

  assertExcluded(): void {
    if (this.enabled) throw new AppError("This administrative action is unavailable.", 403);
  }

  /** Same FACULTY-4 fence/actor lock order as the accepted package write guards. */
  async write<T>(id: string, key: CapabilityKey, work: (tx?: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!this.enabled) return work();
    if (typeof id !== "string" || !id.trim()) throw new AppError("Access denied.", 403);
    const prisma = (await import("../config/database")).default;
    return prisma.$transaction(async tx => {
      const fence = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
      if (fence.length !== 1) throw new AppError("Administrative access is unavailable.", 503);
      await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${id} FOR UPDATE`;
      const account = this.validate(await tx.user.findUnique({ where: { id }, select: CURRENT_ACTOR_SELECT }), id);
      const access = resolveConfiguredAccountAccess(account);
      if (access.category !== "ADMIN" || !hasConfiguredCapability(access, key)) {
        throw new AppError("Access denied.", 403);
      }
      return work(tx);
    });
  }
}
export const operationalAuthorization = new OperationalAuthorization();
