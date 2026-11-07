import type { Prisma, PrismaClient } from "@prisma/client";
import { deniedConfiguredAccess, resolveConfiguredAccountAccess, type ConfiguredAccountAccess } from "./account-access";

export const ACCOUNT_ACCESS_SELECT = {
  id: true, role: true, isActive: true,
  panelist: { select: { isActive: true } },
  administratorAccess: { select: { level: true } },
  capabilityGrants: { select: { capabilityKey: true } },
} as const satisfies Prisma.UserSelect;

/** Inject a client/transaction; never imports the auto-connecting application singleton. */
export async function readConfiguredAccountAccess(
  database: Pick<PrismaClient, "user">, userId: string,
): Promise<ConfiguredAccountAccess> {
  if (typeof userId !== "string" || !userId.trim()) return deniedConfiguredAccess(null, "NOT_FOUND");
  try {
    const snapshot = await database.user.findUnique({ where: { id: userId }, select: ACCOUNT_ACCESS_SELECT });
    if (snapshot && snapshot.id !== userId) return deniedConfiguredAccess(userId, "INVALID_CONFIGURATION");
    return resolveConfiguredAccountAccess(snapshot);
  } catch {
    // No legacy ADMIN or cached-token fallback on database/schema errors.
    return deniedConfiguredAccess(userId, "UNAVAILABLE");
  }
}
