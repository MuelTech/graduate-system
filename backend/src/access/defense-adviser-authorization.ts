import type { Prisma } from "@prisma/client";
import { resolveConfiguredAccountAccess, hasConfiguredCapability } from "./account-access";
import type { CurrentAccount } from "../services/current-account";
import { ACCOUNT_ACCESS_SELECT } from "./account-access.store";
import { AppError } from "../utils/AppError";

/** FACULTY-7 only. Activation requires reviewed code composition, never runtime input. */
export const DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED: boolean = false;
export type DefenseAdviserCapability =
  | "adviser.requests.view" | "adviser.requests.review"
  | "defense.applications.view" | "defense.applications.review"
  | "defense.schedules.view" | "defense.schedules.manage" | "defense.records.view";
type Transaction = Pick<Prisma.TransactionClient, "user" | "$queryRaw">;
const CURRENT_ACTOR_SELECT = { ...ACCOUNT_ACCESS_SELECT, email: true, mustChangePassword: true } as const;
const loadCurrentActor = async (id: string) => (await import("../services/current-account")).loadCurrentAccount(id);

/** Internal DI seam. Only an authenticated ID enters; grants are always reloaded. */
export class DefenseAdviserAuthorization {
  constructor(private readonly enabled = DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED,
    private readonly loadActor = loadCurrentActor) {}

  private assertAccount(account: CurrentAccount | null, actorId: string, capability: DefenseAdviserCapability) {
    const access = resolveConfiguredAccountAccess(account);
    if (!account || account.id !== actorId || account.mustChangePassword !== false ||
        access.category !== "ADMIN" || !hasConfiguredCapability(access, capability)) {
      throw new AppError("Administrative capability is required.", 403);
    }
  }

  async assert(actorId: string, capability: DefenseAdviserCapability): Promise<void> {
    if (!this.enabled) return;
    if (typeof actorId !== "string" || !actorId.trim()) throw new AppError("Administrative actor is required.", 403);
    this.assertAccount(await this.loadActor(actorId), actorId, capability);
  }

  /** No accepted capability authorizes directory browsing, reminders or deferred outputs. */
  assertExcluded(): void {
    if (this.enabled) throw new AppError("This administrative action is not available through Defense/Adviser access.", 403);
  }

  async assertAvailableAdvisers(actorId: string): Promise<void> {
    if (!this.enabled) return;
    const actor = await this.loadActor(actorId);
    if (!actor || actor.id !== actorId || actor.isActive !== true || actor.mustChangePassword !== false || actor.role !== "STUDENT") {
      this.assertExcluded();
    }
  }

  /** FACULTY-4 fence -> actor lock/reload -> existing workflow locks and reads. */
  async assertInTransaction(tx: Transaction, actorId: string, capability: DefenseAdviserCapability): Promise<void> {
    if (!this.enabled) return;
    if (typeof actorId !== "string" || !actorId.trim()) throw new AppError("Administrative actor is required.", 403);
    const fence = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
    if (fence.length !== 1) throw new AppError("Administrative access fence is unavailable.", 503);
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${actorId} FOR UPDATE`;
    this.assertAccount(await tx.user.findUnique({ where: { id: actorId }, select: CURRENT_ACTOR_SELECT }), actorId, capability);
  }
}
export const defenseAdviserAuthorization = new DefenseAdviserAuthorization();
