import { Prisma, type PrismaClient } from "@prisma/client";
import prisma from "../config/database";
import { ACCOUNT_ACCESS_SELECT } from "../access/account-access.store";
import { AppError } from "../utils/AppError";

export const ADMINISTRATOR_ACCOUNT_SELECT = {
  ...ACCOUNT_ACCESS_SELECT, firstName: true, lastName: true, email: true, mustChangePassword: true,
} as const satisfies Prisma.UserSelect;
export type AdministratorAccount = Prisma.UserGetPayload<{ select: typeof ADMINISTRATOR_ACCOUNT_SELECT }>;

export class AdministratorAccessRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  /** Every management read/mutation shares this fence. Never upsert a missing fence at runtime. */
  async withLock<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.database.$transaction(async tx => {
      const fence = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
      if (fence.length !== 1 || fence[0].id !== 1) throw new AppError("Administrator access fence is unavailable.", 503);
      // Stable order, then fresh READ COMMITTED actor/target/population reads.
      await tx.$queryRaw`SELECT user_id FROM users WHERE role = 'ADMIN' ORDER BY user_id FOR UPDATE`;
      return operation(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });
  }

  findAccount(tx: Prisma.TransactionClient, id: string) {
    return tx.user.findUnique({ where: { id }, select: ADMINISTRATOR_ACCOUNT_SELECT });
  }
  listAccounts(tx: Prisma.TransactionClient, page: number, pageSize: number) {
    return tx.user.findMany({ where: { role: "ADMIN" }, select: ADMINISTRATOR_ACCOUNT_SELECT,
      skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: "asc" } });
  }
  activeFullAccounts(tx: Prisma.TransactionClient) {
    return tx.user.findMany({ where: { role: "ADMIN", isActive: true, administratorAccess: { is: { level: "FULL" } } },
      select: ADMINISTRATOR_ACCOUNT_SELECT });
  }
}
