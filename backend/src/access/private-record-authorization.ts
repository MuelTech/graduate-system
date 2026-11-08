import { resolveConfiguredAccountAccess, hasConfiguredCapability } from "./account-access";
import type { CapabilityKey } from "./capability-catalog";
import type { CurrentAccount } from "../services/current-account";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AppError } from "../utils/AppError";

/** FACULTY-8 only. Activation requires reviewed code composition. */
export const PRIVATE_RECORD_ENFORCEMENT_ENABLED: boolean = false;
export interface PrivateRecordActor { userId: string; role: string }
export type PrivateRecordCapability = Extract<CapabilityKey,
  "cor.view" | "students.view" | "defense.applications.view" |
  "defense.schedules.view" | "defense.records.view" | "adviser.requests.view">;
const loadActor = async (id: string) => (await import("../services/current-account")).loadCurrentAccount(id);

/** Bounded DI seam; request/JWT/DB settings cannot enable enforcement. */
export class PrivateRecordAuthorization {
  constructor(readonly enabled = PRIVATE_RECORD_ENFORCEMENT_ENABLED,
    private readonly load = loadActor) {}

  async current(actor: PrivateRecordActor): Promise<PrivateRecordActor> {
    if (!this.enabled) return actor;
    if (!actor?.userId) throw new AppError("Current actor is required.", 403);
    const account = await this.account(actor.userId);
    return { userId: account.id, role: account.role };
  }

  private async account(id: string): Promise<CurrentAccount> {
    if (typeof id !== "string" || !id.trim()) throw new AppError("Current account is required.", 403);
    const account = await this.load(id);
    if (!account || account.id !== id || account.isActive !== true || account.mustChangePassword !== false ||
        !["APPLICANT", "STUDENT", "ADMIN", "PANELIST", "FACULTY"].includes(account.role) ||
        (isAcademicAccountRole(account.role) && account.panelist?.isActive !== true)) {
      throw new AppError("Current account access denied.", 403);
    }
    if (account.role === "ADMIN" && resolveConfiguredAccountAccess(account).status !== "RESOLVED") {
      throw new AppError("Administrative access is unavailable.", 403);
    }
    return account;
  }

  async can(actor: PrivateRecordActor, capability: PrivateRecordCapability): Promise<boolean> {
    if (!actor?.userId) return false;
    if (!this.enabled) return actor.role === "ADMIN";
    const account = await this.account(actor.userId);
    const access = resolveConfiguredAccountAccess(account);
    return access.category === "ADMIN" && hasConfiguredCapability(access, capability);
  }

  async admin(actor: PrivateRecordActor, capability: PrivateRecordCapability): Promise<void> {
    if (!await this.can(actor, capability)) throw new AppError("Administrative capability is required.", 403);
  }
}
export const privateRecordAuthorization = new PrivateRecordAuthorization();
