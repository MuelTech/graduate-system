import type { Prisma } from "@prisma/client";
import { ACCOUNT_ACCESS_SELECT } from "./account-access.store";
import { hasConfiguredCapability, resolveConfiguredAccountAccess } from "./account-access";
import { isAcademicAccountRole } from "../utils/academic-account";
import { AppError } from "../utils/AppError";

/** Coordinated activation only. No environment/request/setting/JWT switch. */
export const FACULTY_ESSAY_EVALUATION_ENABLED: boolean = false;
export const ESSAY_ACTOR_SELECT = {
  ...ACCOUNT_ACCESS_SELECT, mustChangePassword: true,
  panelist: { select: { id: true, userId: true, isActive: true } },
} as const satisfies Prisma.UserSelect;
type Actor = Prisma.UserGetPayload<{ select: typeof ESSAY_ACTOR_SELECT }>;
type Transaction = Pick<Prisma.TransactionClient, "user" | "$queryRaw">;
const loadActor = async (id: string) => (await import("../config/database")).default.user.findUnique({
  where: { id }, select: ESSAY_ACTOR_SELECT,
});

/** Adapter to the accepted resolver; callers supply only authenticated identity. */
export class FacultyEssayAuthorization {
  constructor(readonly enabled = FACULTY_ESSAY_EVALUATION_ENABLED, private readonly load = loadActor) {}

  private ready(actorId: string) {
    if (!this.enabled) throw new AppError("Essay Evaluation is currently unavailable.", 503);
    if (typeof actorId !== "string" || !actorId.trim()) throw new AppError("Essay Evaluation access denied.", 403);
  }
  private validate(account: Actor | null, actorId: string) {
    const access = resolveConfiguredAccountAccess(account);
    if (!account || account.id !== actorId || !isAcademicAccountRole(account.role) ||
        account.mustChangePassword !== false || !account.panelist?.id || account.panelist.userId !== actorId ||
        access.category !== "FACULTY" || !hasConfiguredCapability(access, "essay.evaluate")) {
      throw new AppError("Essay Evaluation access denied.", 403);
    }
  }
  async assert(actorId: string) {
    this.ready(actorId);
    this.validate(await this.load(actorId), actorId);
  }
  /** Close the legacy academic writer whenever this target is composed, independently
   * of the older Exam Administration rollout gate. Dormant compatibility is unchanged.
   */
  assertLegacyAdminGrading() {
    if (this.enabled) throw new AppError("Essay evaluation is unavailable through Exam Administration.", 403);
  }
  async assertRead(tx: Transaction, actorId: string) {
    this.ready(actorId);
    this.validate(await tx.user.findUnique({ where: { id: actorId }, select: ESSAY_ACTOR_SELECT }), actorId);
  }
  async lockEvaluator(tx: Transaction, actorId: string) {
    this.ready(actorId);
    // Same sentinel and lock order as Faculty grant/status writers, before workflow locks.
    const fence = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
    if (fence.length !== 1 || fence[0].id !== 1) throw new AppError("Essay Evaluation access is unavailable.", 503);
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${actorId} FOR UPDATE`;
    await tx.$queryRaw`SELECT panelist_id FROM panelists WHERE user_id = ${actorId} FOR UPDATE`;
    // READ COMMITTED, after every wait: no cached/pre-transaction grant can authorize a write.
    await this.assertRead(tx, actorId);
  }
}
export const facultyEssayAuthorization = new FacultyEssayAuthorization();
