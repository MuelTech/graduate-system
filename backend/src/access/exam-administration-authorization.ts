import type { Prisma } from "@prisma/client";
import { resolveConfiguredAccountAccess, hasConfiguredCapability } from "./account-access";
import type { CurrentAccount } from "../services/current-account";
import { ACCOUNT_ACCESS_SELECT } from "./account-access.store";
import { AppError } from "../utils/AppError";

/** FACULTY-6 only. Code-owned; no environment, request or database setting enables it.
 * Legacy ADMIN routes remain authoritative until the controlled activation package.
 */
export const EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED: boolean = false;

export type ExamAdministrationCapability =
  | "exam.schedules.view" | "exam.schedules.manage" | "exam.records.view"
  | "exam.starts.authorize" | "exam.results.finalize" | "exam.results.reconsider"
  | "exam.questions.view" | "exam.questions.manage" | "exam.configuration.manage";

type Actor = CurrentAccount;
type Transaction = Pick<Prisma.TransactionClient, "user" | "$queryRaw">;
const CURRENT_ACTOR_SELECT = { ...ACCOUNT_ACCESS_SELECT, email: true, mustChangePassword: true } as const;
// Dormant service composition must not initialize a database connection just to import a guard.
const loadCurrentActor = async (id: string) => (await import("../services/current-account")).loadCurrentAccount(id);

/** Internal constructor injection is the bounded synthetic-test/future-composition seam.
 * Callers supply only the authenticated actor ID, never a preauthorized grant snapshot.
 */
export class ExamAdministrationAuthorization {
  constructor(
    private readonly enabled = EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED,
    private readonly loadActor = loadCurrentActor,
  ) {}

  private assertAccount(account: Actor | null, actorId: string, capability: ExamAdministrationCapability) {
    const access = resolveConfiguredAccountAccess(account);
    if (!account || account.id !== actorId || account.mustChangePassword !== false ||
        access.category !== "ADMIN" || !hasConfiguredCapability(access, capability)) {
      throw new AppError("Administrative capability is required.", 403);
    }
  }

  async assert(actorId: string, capability: ExamAdministrationCapability): Promise<void> {
    if (!this.enabled) return;
    if (typeof actorId !== "string" || !actorId.trim()) throw new AppError("Administrative actor is required.", 403);
    this.assertAccount(await this.loadActor(actorId), actorId, capability);
  }

  /** No administrative capability (including Full) grants these deferred actions. */
  assertExcluded(action: "ESSAY_EVALUATION" | "RESULT_EMAIL"): void {
    if (this.enabled) throw new AppError(`${action === "ESSAY_EVALUATION" ? "Essay evaluation" : "Result email"} is unavailable through Exam Administration.`, 403);
  }

  /** Mixed media is the sole shared Admin/Applicant surface. Never trust its caller role. */
  async mediaActor(actor: { userId: string; role: string }) {
    if (!this.enabled) return actor;
    const current = await this.loadActor(actor.userId);
    if (!current || current.id !== actor.userId || current.isActive !== true || current.mustChangePassword !== false ||
        !["ADMIN", "APPLICANT"].includes(current.role)) throw new AppError("Forbidden.", 403);
    return { userId: current.id, role: current.role };
  }

  /** Share FACULTY-4's writer fence BEFORE workflow locks. Grant/status writers
   * cannot revoke between this fresh read and commit, or race a stale snapshot.
   * No runtime fence creation; an absent sentinel fails closed.
   */
  async assertInTransaction(tx: Transaction, actorId: string, capability: ExamAdministrationCapability): Promise<void> {
    if (!this.enabled) return;
    if (typeof actorId !== "string" || !actorId.trim()) throw new AppError("Administrative actor is required.", 403);
    const fence = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
    if (fence.length !== 1) throw new AppError("Administrative access fence is unavailable.", 503);
    // Both locks precede the owning transaction's first consistent account/grant read.
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${actorId} FOR UPDATE`;
    const account = await tx.user.findUnique({ where: { id: actorId }, select: CURRENT_ACTOR_SELECT });
    this.assertAccount(account, actorId, capability);
  }
}

export const examAdministrationAuthorization = new ExamAdministrationAuthorization();
